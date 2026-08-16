using System.Runtime.CompilerServices;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace eDMS.Infrastructure.Security;

/// <summary>
/// Resolves effective permission by walking the object up to its Site, checking unique
/// <c>item_permissions</c> at each level before falling through to <c>site_permissions</c>.
/// The hierarchy walk is a single recursive CTE (TDS §6.3) — one round trip instead of
/// N+1 queries — followed by one grant query across the whole chain. Results are cached
/// for 30s and invalidated by <see cref="IPermissionCacheInvalidator"/>.
/// Non-relational providers (e.g. the EF InMemory test database) have no raw-SQL support
/// and fall back to the equivalent C# ancestor walk.
/// </summary>
public sealed class PermissionResolver(
    AppDbContext db,
    ICurrentUser currentUser,
    IMemoryCache cache,
    IPermissionCacheInvalidator invalidator) : IPermissionResolver
{
    public async Task<PermissionLevel> GetEffectiveLevelAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        if (currentUser.IsSystemAdmin)
        {
            return PermissionLevel.FullControl;
        }

        var key = $"perm:{userId}:{type}:{objectId}:{invalidator.Generation}";
        return await cache.GetOrCreateAsync(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            return ResolveAsync(userId, type, objectId, cancellationToken);
        });
    }

    public async Task RequireAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        PermissionLevel required,
        CancellationToken cancellationToken = default)
    {
        var granted = await GetEffectiveLevelAsync(userId, type, objectId, cancellationToken);
        if (granted > required)
        {
            throw new ForbiddenException();
        }
    }

    private Task<PermissionLevel> ResolveAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        return db.Database.IsRelational()
            ? ResolveWithCteAsync(userId, type, objectId, cancellationToken)
            : ResolveWithCSharpWalkAsync(userId, type, objectId, cancellationToken);
    }

    // ------------------------------------------------------------------ CTE path

    private async Task<PermissionLevel> ResolveWithCteAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        if (type is not (ObjectType.Site or ObjectType.Library or ObjectType.Folder or ObjectType.Document))
        {
            return PermissionLevel.NoAccess;
        }

        var rows = await LoadChainAsync((int)type, objectId, cancellationToken);
        if (rows.Count == 0)
        {
            return PermissionLevel.NoAccess;
        }

        var siteRow = rows.FirstOrDefault(row => row.ObjectType == (int)ObjectType.Site);
        if (siteRow is null)
        {
            return PermissionLevel.NoAccess;
        }

        var grants = await LoadChainGrantsAsync(userId, rows, cancellationToken);

        foreach (var row in rows.Where(row => row.ObjectType != (int)ObjectType.Site))
        {
            var level = BestGrantFor(grants, row.ObjectType, row.ObjectId);
            if (level != PermissionLevel.NoAccess)
            {
                return level;
            }
        }

        return await ResolveSiteLevelAsync(userId, siteRow.ObjectId, cancellationToken);
    }

    private async Task<List<PermissionChainRow>> LoadChainAsync(
        int objectType,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        // WITH RECURSIVE works on Postgres/SQLite/MySQL; SQL Server uses plain WITH.
        // The keyword is a compile-time constant baked into the format string (it
        // cannot be a SQL parameter); the object type/id are parameterized.
        const string body = """
            chain AS (
                SELECT {0} AS ObjectType, {1} AS ObjectId, 0 AS Depth
                UNION ALL
                SELECT 2, f.parent_folder_id, c.Depth + 1
                FROM chain c
                JOIN folders f ON c.ObjectType = 2 AND f.id = c.ObjectId AND f.parent_folder_id IS NOT NULL
                WHERE c.Depth < 20
                UNION ALL
                SELECT 1, f.library_id, c.Depth + 1
                FROM chain c
                JOIN folders f ON c.ObjectType = 2 AND f.id = c.ObjectId AND f.parent_folder_id IS NULL
                WHERE c.Depth < 20
                UNION ALL
                SELECT 0, l.site_id, c.Depth + 1
                FROM chain c
                JOIN libraries l ON c.ObjectType = 1 AND l.id = c.ObjectId
                WHERE c.Depth < 20
                UNION ALL
                SELECT 2, d.folder_id, c.Depth + 1
                FROM chain c
                JOIN documents d ON c.ObjectType = 3 AND d.id = c.ObjectId AND d.folder_id IS NOT NULL
                WHERE c.Depth < 20
                UNION ALL
                SELECT 1, d.library_id, c.Depth + 1
                FROM chain c
                JOIN documents d ON c.ObjectType = 3 AND d.id = c.ObjectId AND d.folder_id IS NULL
                WHERE c.Depth < 20
            )
            SELECT ObjectType AS object_type, ObjectId AS object_id, Depth AS depth FROM chain ORDER BY Depth
            """;

        var keyword = db.Database.IsSqlServer() ? string.Empty : "RECURSIVE ";
        var sql = FormattableStringFactory.Create(
            $"WITH {keyword}{body}",
            objectType,
            objectId);

        return await db.Database
            .SqlQuery<PermissionChainRow>(sql)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<ChainGrant>> LoadChainGrantsAsync(
        Guid userId,
        List<PermissionChainRow> rows,
        CancellationToken cancellationToken)
    {
        var folderIds = Ids(rows, ObjectType.Folder);
        var libraryIds = Ids(rows, ObjectType.Library);
        var documentIds = Ids(rows, ObjectType.Document);

        var direct = await db.ItemPermissions.AsNoTracking()
            .Where(permission => permission.PrincipalType == PrincipalType.User
                && permission.PrincipalId == userId
                && ((permission.ObjectType == ObjectType.Folder && folderIds.Contains(permission.ObjectId))
                    || (permission.ObjectType == ObjectType.Library && libraryIds.Contains(permission.ObjectId))
                    || (permission.ObjectType == ObjectType.Document && documentIds.Contains(permission.ObjectId))))
            .Select(permission => new ChainGrant((int)permission.ObjectType, permission.ObjectId, (int)permission.Level))
            .ToListAsync(cancellationToken);

        var groupGrants = await db.ItemPermissions.AsNoTracking()
            .Where(permission => permission.PrincipalType == PrincipalType.Group
                && ((permission.ObjectType == ObjectType.Folder && folderIds.Contains(permission.ObjectId))
                    || (permission.ObjectType == ObjectType.Library && libraryIds.Contains(permission.ObjectId))
                    || (permission.ObjectType == ObjectType.Document && documentIds.Contains(permission.ObjectId))))
            .Join(
                db.GroupMembers,
                permission => permission.PrincipalId,
                member => member.GroupId,
                (permission, member) => new { permission.ObjectType, permission.ObjectId, permission.Level, member.UserId })
            .Where(joined => joined.UserId == userId)
            .Select(joined => new ChainGrant((int)joined.ObjectType, joined.ObjectId, (int)joined.Level))
            .ToListAsync(cancellationToken);

        return direct.Concat(groupGrants).ToList();
    }

    private static List<Guid> Ids(List<PermissionChainRow> rows, ObjectType type) =>
        rows.Where(row => row.ObjectType == (int)type).Select(row => row.ObjectId).ToList();

    private static PermissionLevel BestGrantFor(
        List<ChainGrant> grants,
        int objectType,
        Guid objectId)
    {
        var levels = grants
            .Where(grant => grant.ObjectType == objectType && grant.ObjectId == objectId)
            .Select(grant => (PermissionLevel)grant.Level)
            .Where(level => level != PermissionLevel.NoAccess)
            .ToList();

        return levels.Count == 0 ? PermissionLevel.NoAccess : levels.Min();
    }

    // ---------------------------------------------------------- legacy C# walk

    private async Task<PermissionLevel> ResolveWithCSharpWalkAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        var ancestors = new List<(ObjectType Type, Guid Id)>();
        Guid siteId;

        switch (type)
        {
            case ObjectType.Site:
                siteId = objectId;
                break;

            case ObjectType.Library:
                var library = await db.Libraries.IgnoreQueryFilters()
                    .SingleOrDefaultAsync(item => item.Id == objectId, cancellationToken);
                if (library is null)
                {
                    return PermissionLevel.NoAccess;
                }
                siteId = library.SiteId;
                ancestors.Add((ObjectType.Library, objectId));
                break;

            case ObjectType.Folder:
                var folder = await db.Folders.IgnoreQueryFilters()
                    .SingleOrDefaultAsync(item => item.Id == objectId, cancellationToken);
                if (folder is null)
                {
                    return PermissionLevel.NoAccess;
                }
                siteId = await CollectFolderAncestorsAsync(folder, ancestors, cancellationToken);
                break;

            case ObjectType.Document:
                var document = await db.Documents.IgnoreQueryFilters()
                    .SingleOrDefaultAsync(item => item.Id == objectId, cancellationToken);
                if (document is null)
                {
                    return PermissionLevel.NoAccess;
                }
                ancestors.Add((ObjectType.Document, objectId));
                if (document.FolderId is { } folderId)
                {
                    var parentFolder = await db.Folders.IgnoreQueryFilters()
                        .SingleOrDefaultAsync(item => item.Id == folderId, cancellationToken);
                    if (parentFolder is null)
                    {
                        return PermissionLevel.NoAccess;
                    }
                    siteId = await CollectFolderAncestorsAsync(parentFolder, ancestors, cancellationToken);
                }
                else
                {
                    ancestors.Add((ObjectType.Library, document.LibraryId));
                    siteId = await db.Libraries.IgnoreQueryFilters()
                        .Where(item => item.Id == document.LibraryId)
                        .Select(item => item.SiteId)
                        .SingleOrDefaultAsync(cancellationToken);
                }
                break;

            default:
                return PermissionLevel.NoAccess;
        }

        if (siteId == Guid.Empty)
        {
            return PermissionLevel.NoAccess;
        }

        foreach (var ancestor in ancestors)
        {
            var level = await ResolveItemLevelAsync(userId, ancestor.Type, ancestor.Id, cancellationToken);
            if (level != PermissionLevel.NoAccess)
            {
                return level;
            }
        }

        return await ResolveSiteLevelAsync(userId, siteId, cancellationToken);
    }

    private async Task<Guid> CollectFolderAncestorsAsync(
        Folder folder,
        List<(ObjectType Type, Guid Id)> ancestors,
        CancellationToken cancellationToken)
    {
        var current = folder;
        var depth = 0;
        while (current is not null && depth < 20)
        {
            ancestors.Add((ObjectType.Folder, current.Id));
            if (current.ParentFolderId is not { } parentId)
            {
                break;
            }

            current = await db.Folders.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == parentId, cancellationToken);
            depth++;
        }

        ancestors.Add((ObjectType.Library, folder.LibraryId));
        return await db.Libraries.IgnoreQueryFilters()
            .Where(item => item.Id == folder.LibraryId)
            .Select(item => item.SiteId)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<PermissionLevel> ResolveItemLevelAsync(
        Guid userId,
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        var direct = await db.ItemPermissions
            .Where(permission => permission.ObjectType == objectType
                && permission.ObjectId == objectId
                && permission.PrincipalType == PrincipalType.User
                && permission.PrincipalId == userId)
            .Select(permission => (int)permission.Level)
            .ToListAsync(cancellationToken);

        var groupLevels = await db.ItemPermissions
            .Where(permission => permission.ObjectType == objectType
                && permission.ObjectId == objectId
                && permission.PrincipalType == PrincipalType.Group)
            .Join(
                db.GroupMembers,
                permission => permission.PrincipalId,
                member => member.GroupId,
                (permission, member) => new { permission.Level, member.UserId })
            .Where(joined => joined.UserId == userId)
            .Select(joined => (int)joined.Level)
            .ToListAsync(cancellationToken);

        var levels = direct.Concat(groupLevels)
            .Select(level => (PermissionLevel)level)
            .Where(level => level != PermissionLevel.NoAccess)
            .ToList();

        return levels.Count == 0 ? PermissionLevel.NoAccess : levels.Min();
    }

    private async Task<PermissionLevel> ResolveSiteLevelAsync(
        Guid userId,
        Guid siteId,
        CancellationToken cancellationToken)
    {
        var directRoles = await db.SitePermissions
            .Where(permission => permission.SiteId == siteId
                && permission.PrincipalType == PrincipalType.User
                && permission.PrincipalId == userId)
            .Select(permission => (int)permission.Role)
            .ToListAsync(cancellationToken);

        var groupRoles = await db.SitePermissions
            .Where(permission => permission.SiteId == siteId
                && permission.PrincipalType == PrincipalType.Group)
            .Join(
                db.GroupMembers,
                permission => permission.PrincipalId,
                member => member.GroupId,
                (permission, member) => new { permission.Role, member.UserId })
            .Where(joined => joined.UserId == userId)
            .Select(joined => (int)joined.Role)
            .ToListAsync(cancellationToken);

        var roles = directRoles.Concat(groupRoles).ToList();
        return roles.Count == 0
            ? PermissionLevel.NoAccess
            : ((SiteRole)roles.Min()).ToPermissionLevel();
    }

    private sealed record PermissionChainRow(int ObjectType, Guid ObjectId, int Depth);

    private sealed record ChainGrant(int ObjectType, Guid ObjectId, int Level);
}
