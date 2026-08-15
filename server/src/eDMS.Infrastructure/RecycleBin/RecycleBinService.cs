using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.RecycleBin;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.RecycleBin;

public sealed class RecycleBinService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IFileStorageProvider storage) : IRecycleBinService
{
    public async Task<IReadOnlyList<RecycleBinItemDto>> ListAsync(Guid siteId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Site, siteId, PermissionLevel.Read, cancellationToken);

        var libraryIds = db.Libraries.IgnoreQueryFilters()
            .Where(library => library.SiteId == siteId)
            .Select(library => library.Id);

        var documents = await db.Documents.IgnoreQueryFilters()
            .Where(document => document.IsDeleted && libraryIds.Contains(document.LibraryId))
            .Select(document => new RecycleBinItemDto(document.Id, "document", document.Name, document.DeletedAt, document.DeletedBy, siteId))
            .ToListAsync(cancellationToken);

        var folders = await db.Folders.IgnoreQueryFilters()
            .Where(folder => folder.IsDeleted && libraryIds.Contains(folder.LibraryId))
            .Select(folder => new RecycleBinItemDto(folder.Id, "folder", folder.Name, folder.DeletedAt, folder.DeletedBy, siteId))
            .ToListAsync(cancellationToken);

        return documents.Concat(folders).OrderByDescending(item => item.DeletedAt).ToList();
    }

    public async Task RestoreAsync(ObjectType objectType, Guid itemId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();

        if (objectType == ObjectType.Document)
        {
            var document = await db.Documents.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == itemId, cancellationToken)
                ?? throw new NotFoundException(nameof(Document), itemId);
            await permissions.RequireAsync(userId, ObjectType.Library, document.LibraryId, PermissionLevel.Contribute, cancellationToken);
            document.Restore();
        }
        else if (objectType == ObjectType.Folder)
        {
            var folder = await db.Folders.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == itemId, cancellationToken)
                ?? throw new NotFoundException(nameof(Folder), itemId);
            await permissions.RequireAsync(userId, ObjectType.Library, folder.LibraryId, PermissionLevel.Contribute, cancellationToken);

            var descendants = await db.Folders.IgnoreQueryFilters()
                .Where(item => item.Path.StartsWith(folder.Path))
                .ToListAsync(cancellationToken);
            foreach (var descendant in descendants)
            {
                descendant.Restore();
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task PermanentlyDeleteAsync(ObjectType objectType, Guid itemId, CancellationToken cancellationToken = default)
    {
        if (objectType == ObjectType.Document)
        {
            var document = await db.Documents.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == itemId, cancellationToken)
                ?? throw new NotFoundException(nameof(Document), itemId);

            var versions = await db.DocumentVersions
                .Where(version => version.DocumentId == document.Id)
                .ToListAsync(cancellationToken);
            foreach (var version in versions)
            {
                await storage.DeleteAsync(version.StorageKey, cancellationToken);
            }

            db.Documents.Remove(document);
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (objectType == ObjectType.Folder)
        {
            var folder = await db.Folders.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == itemId, cancellationToken)
                ?? throw new NotFoundException(nameof(Folder), itemId);

            var descendants = await db.Folders.IgnoreQueryFilters()
                .Where(item => item.Path.StartsWith(folder.Path))
                .ToListAsync(cancellationToken);
            var folderIds = descendants.Select(item => item.Id).ToList();

            var documents = await db.Documents.IgnoreQueryFilters()
                .Where(document => document.FolderId != null && folderIds.Contains(document.FolderId.Value))
                .ToListAsync(cancellationToken);

            var documentIds = documents.Select(item => item.Id).ToList();
            var versions = await db.DocumentVersions
                .Where(version => documentIds.Contains(version.DocumentId))
                .ToListAsync(cancellationToken);
            foreach (var version in versions)
            {
                await storage.DeleteAsync(version.StorageKey, cancellationToken);
            }

            db.Documents.RemoveRange(documents);
            db.Folders.RemoveRange(descendants);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
