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
/// Results are cached for 30s and invalidated by <see cref="IPermissionCacheInvalidator"/>.
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

    private async Task<PermissionLevel> ResolveAsync(
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
}
