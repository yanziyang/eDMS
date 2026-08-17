using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Favorites;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Favorites;

public sealed class FavoritesService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IFavoritesService
{
    public async Task AddAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        EnsureSupportedType(objectType);
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var target = await LoadTargetsAsync(objectType, [objectId], cancellationToken);
        if (!target.ContainsKey((objectType, objectId)))
        {
            throw new NotFoundException(objectType.ToString(), objectId);
        }

        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.Read, cancellationToken);

        var existing = await db.FavoriteItems.SingleOrDefaultAsync(
            item => item.UserId == userId
                && item.ObjectType == objectType
                && item.ObjectId == objectId,
            cancellationToken);
        if (existing is null)
        {
            db.FavoriteItems.Add(new FavoriteItem
            {
                UserId = userId,
                ObjectType = objectType,
                ObjectId = objectId,
            });
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task RemoveAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        EnsureSupportedType(objectType);
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var existing = await db.FavoriteItems.SingleOrDefaultAsync(
            item => item.UserId == userId
                && item.ObjectType == objectType
                && item.ObjectId == objectId,
            cancellationToken);
        if (existing is null)
        {
            return;
        }

        db.FavoriteItems.Remove(existing);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FavoriteItemDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var favorites = await db.FavoriteItems.AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.ObjectType)
            .ThenBy(item => item.ObjectId)
            .ToListAsync(cancellationToken);
        if (favorites.Count == 0)
        {
            return [];
        }

        // Resolve all display/location fields in one query per polymorphic type;
        // permission checks below intentionally remain caller-specific.
        var targets = new Dictionary<(ObjectType Type, Guid Id), FavoriteTarget>();
        foreach (var group in favorites.GroupBy(item => item.ObjectType))
        {
            var ids = group.Select(item => item.ObjectId).ToList();
            foreach (var target in await LoadTargetsAsync(group.Key, ids, cancellationToken))
            {
                targets[target.Key] = target.Value;
            }
        }

        var result = new List<FavoriteItemDto>(favorites.Count);
        foreach (var favorite in favorites)
        {
            if (!targets.TryGetValue((favorite.ObjectType, favorite.ObjectId), out var target))
            {
                continue;
            }

            var level = await permissions.GetEffectiveLevelAsync(
                userId,
                favorite.ObjectType,
                favorite.ObjectId,
                cancellationToken);
            if (level == PermissionLevel.NoAccess)
            {
                continue;
            }

            result.Add(new FavoriteItemDto(
                favorite.ObjectId,
                favorite.ObjectType,
                target.Name,
                target.Location,
                target.SiteSlug,
                target.LibraryId,
                target.FolderId));
        }

        return result;
    }

    private async Task<Dictionary<(ObjectType Type, Guid Id), FavoriteTarget>> LoadTargetsAsync(
        ObjectType objectType,
        IReadOnlyCollection<Guid> ids,
        CancellationToken cancellationToken)
    {
        return objectType switch
        {
            ObjectType.Site => (await db.Sites.AsNoTracking()
                    .Where(site => ids.Contains(site.Id))
                    .Select(site => new SiteTargetRow(site.Id, site.Name, site.UrlSlug))
                    .ToListAsync(cancellationToken))
                .ToDictionary(
                    row => (ObjectType.Site, row.Id),
                    row => new FavoriteTarget(row.Name, "Site", row.SiteSlug, null, null)),
            ObjectType.Library => (await (
                    from library in db.Libraries.AsNoTracking()
                    join site in db.Sites.AsNoTracking() on library.SiteId equals site.Id
                    where ids.Contains(library.Id)
                    select new LibraryTargetRow(library.Id, library.Name, site.Name, site.UrlSlug)
                ).ToListAsync(cancellationToken))
                .ToDictionary(
                    row => (ObjectType.Library, row.Id),
                    row => new FavoriteTarget(row.Name, row.SiteName, row.SiteSlug, row.Id, null)),
            ObjectType.Folder => (await (
                    from folder in db.Folders.AsNoTracking()
                    join library in db.Libraries.AsNoTracking() on folder.LibraryId equals library.Id
                    join site in db.Sites.AsNoTracking() on library.SiteId equals site.Id
                    where ids.Contains(folder.Id)
                    select new FolderTargetRow(folder.Id, folder.Name, folder.Path, library.Id, library.Name, site.Name, site.UrlSlug)
                ).ToListAsync(cancellationToken))
                .ToDictionary(
                    row => (ObjectType.Folder, row.Id),
                    row => new FavoriteTarget(
                        row.Name,
                        BuildLocation(row.SiteName, row.LibraryName, row.Path),
                        row.SiteSlug,
                        row.LibraryId,
                        row.Id)),
            ObjectType.Document => (await (
                    from document in db.Documents.AsNoTracking()
                    join library in db.Libraries.AsNoTracking() on document.LibraryId equals library.Id
                    join site in db.Sites.AsNoTracking() on library.SiteId equals site.Id
                    join folder in db.Folders.AsNoTracking() on document.FolderId equals folder.Id into folders
                    from folder in folders.DefaultIfEmpty()
                    where ids.Contains(document.Id) && (document.FolderId == null || folder != null)
                    select new DocumentTargetRow(
                        document.Id,
                        document.Name,
                        folder == null ? null : folder.Path,
                        library.Id,
                        library.Name,
                        site.Name,
                        site.UrlSlug,
                        document.FolderId)
                ).ToListAsync(cancellationToken))
                .ToDictionary(
                    row => (ObjectType.Document, row.Id),
                    row => new FavoriteTarget(
                        row.Name,
                        BuildLocation(row.SiteName, row.LibraryName, row.FolderPath),
                        row.SiteSlug,
                        row.LibraryId,
                        row.FolderId)),
            _ => throw new ConflictException("Favorites support Sites, Libraries, Folders, and Documents only."),
        };
    }

    private static void EnsureSupportedType(ObjectType objectType)
    {
        if (objectType is not (ObjectType.Site or ObjectType.Library or ObjectType.Folder or ObjectType.Document))
        {
            throw new ConflictException("Favorites support Sites, Libraries, Folders, and Documents only.");
        }
    }

    private static string BuildLocation(string siteName, string libraryName, string? folderPath)
    {
        var location = $"{siteName} / {libraryName}";
        if (!string.IsNullOrWhiteSpace(folderPath) && folderPath != "/")
        {
            location += $" / {folderPath.Trim('/')}";
        }

        return location;
    }

    private sealed record FavoriteTarget(
        string Name,
        string Location,
        string SiteSlug,
        Guid? LibraryId,
        Guid? FolderId);

    private sealed record SiteTargetRow(Guid Id, string Name, string SiteSlug);

    private sealed record LibraryTargetRow(Guid Id, string Name, string SiteName, string SiteSlug);

    private sealed record FolderTargetRow(
        Guid Id,
        string Name,
        string Path,
        Guid LibraryId,
        string LibraryName,
        string SiteName,
        string SiteSlug);

    private sealed record DocumentTargetRow(
        Guid Id,
        string Name,
        string? FolderPath,
        Guid LibraryId,
        string LibraryName,
        string SiteName,
        string SiteSlug,
        Guid? FolderId);
}
