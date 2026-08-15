using System.Security.Cryptography;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Documents;

public sealed class DocumentService(
    IAppDbContext db,
    IFileStorageProvider storage,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IAuditLogger audit,
    IOptions<StorageOptions> storageOptions) : IDocumentService
{
    private static readonly string[] BlockedExtensions = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll"];

    public async Task<IReadOnlyList<ItemDto>> ListAsync(
        Guid libraryId,
        Guid? folderId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, libraryId, PermissionLevel.Read, cancellationToken);

        var folders = await db.Folders.AsNoTracking()
            .Where(folder => folder.LibraryId == libraryId && folder.ParentFolderId == folderId)
            .OrderBy(folder => folder.Name)
            .ToListAsync(cancellationToken);

        var documents = await db.Documents.AsNoTracking()
            .Where(document => document.LibraryId == libraryId && document.FolderId == folderId)
            .OrderBy(document => document.Name)
            .ToListAsync(cancellationToken);

        var documentSizes = await db.DocumentVersions.AsNoTracking()
            .Where(version => documents.Select(document => document.Id).Contains(version.DocumentId))
            .GroupBy(version => version.DocumentId)
            .Select(group => new { DocumentId = group.Key, Size = group.Max(version => version.SizeBytes) })
            .ToDictionaryAsync(item => item.DocumentId, item => item.Size, cancellationToken);

        var items = new List<ItemDto>();
        items.AddRange(folders.Select(folder => new ItemDto(
            "folder",
            folder.Id,
            folder.Name,
            0,
            folder.ModifiedAt ?? folder.CreatedAt,
            folder.Id,
            null,
            null)));
        items.AddRange(documents.Select(document => new ItemDto(
            "document",
            document.Id,
            document.Name,
            documentSizes.GetValueOrDefault(document.Id),
            document.ModifiedAt ?? document.CreatedAt,
            null,
            document.Id,
            document.CheckedOutBy)));

        return items;
    }

    public async Task<IReadOnlyList<ItemDto>> ListFolderAsync(Guid folderId, CancellationToken cancellationToken = default)
    {
        var folder = await db.Folders.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == folderId, cancellationToken)
            ?? throw new NotFoundException(nameof(Folder), folderId);

        return await ListAsync(folder.LibraryId, folder.Id, cancellationToken);
    }

    public async Task<UploadResult> UploadAsync(
        Guid libraryId,
        Guid? folderId,
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, libraryId, PermissionLevel.Contribute, cancellationToken);

        var library = await db.Libraries.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == libraryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Library), libraryId);

        var extension = Path.GetExtension(fileName);
        if (BlockedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            throw new ConflictException($"The '{extension}' file type is blocked.");
        }

        var tempPath = Path.Combine(Path.GetTempPath(), $"edms-upload-{Guid.NewGuid():N}.tmp");
        var checksum = string.Empty;
        var sizeBytes = 0L;
        var contentType = "application/octet-stream";

        try
        {
            await using (var tempStream = File.Create(tempPath))
            {
                using var hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
                var buffer = new byte[81920];
                var header = new byte[8];
                var headerBytesRead = 0;

                int read;
                while ((read = await content.ReadAsync(buffer, cancellationToken)) > 0)
                {
                    sizeBytes += read;
                    if (sizeBytes > storageOptions.Value.MaxUploadSizeBytes)
                    {
                        throw new ConflictException("The file exceeds the maximum upload size.");
                    }

                    if (headerBytesRead < 8)
                    {
                        var take = Math.Min(8 - headerBytesRead, read);
                        Array.Copy(buffer, 0, header, headerBytesRead, take);
                        headerBytesRead += take;
                    }

                    hasher.AppendData(buffer, 0, read);
                    await tempStream.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                }

                checksum = Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant();
                contentType = ContentTypeSniffer.Detect(header);
            }

            var existing = await db.Documents.IgnoreQueryFilters()
                .SingleOrDefaultAsync(document =>
                    document.LibraryId == libraryId && document.FolderId == folderId && document.Name == fileName,
                    cancellationToken);

            Document document;
            DocumentVersion version;

            if (existing is not null)
            {
                if (existing.CheckedOutBy is not null && existing.CheckedOutBy != userId)
                {
                    throw new ConflictException("This document is checked out by another user.");
                }

                document = existing;
                var current = await db.DocumentVersions
                    .SingleAsync(item => item.Id == document.CurrentVersionId, cancellationToken);
                var nextMajor = current.VersionMajor + 1;
                version = new DocumentVersion
                {
                    DocumentId = document.Id,
                    VersionMajor = nextMajor,
                    VersionMinor = 0,
                    SizeBytes = sizeBytes,
                    Checksum = checksum,
                    IsMajor = true,
                };
                version.SetCreator(userId);
            }
            else
            {
                document = new Document
                {
                    LibraryId = libraryId,
                    FolderId = folderId,
                    Name = fileName,
                    ContentType = contentType,
                };
                document.SetCreator(userId);
                version = new DocumentVersion
                {
                    DocumentId = document.Id,
                    VersionMajor = 1,
                    VersionMinor = 0,
                    SizeBytes = sizeBytes,
                    Checksum = checksum,
                    IsMajor = true,
                };
                version.SetCreator(userId);
                db.Documents.Add(document);
            }

            var storageKey = $"{library.SiteId}/{libraryId}/{document.Id}/{version.Id}/{fileName}";
            version.StorageKey = storageKey;
            db.DocumentVersions.Add(version);

            document.CurrentVersionId = version.Id;
            document.ContentType = contentType;
            document.ModifiedBy = userId;
            document.ModifiedAt = DateTimeOffset.UtcNow;

            await db.SaveChangesAsync(cancellationToken);

            await using var fileStream = File.OpenRead(tempPath);
            await storage.SaveAsync(fileStream, storageKey, cancellationToken);

            await audit.LogAsync(AuditAction.Upload, ObjectType.Document, document.Id, document.Name, library.SiteId, cancellationToken);

            return new UploadResult(
                document.Id,
                document.Name,
                version.Id,
                $"{version.VersionMajor}.{version.VersionMinor}",
                sizeBytes,
                existing is null ? "created" : "new-version");
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    public async Task<UploadResult> UploadToFolderAsync(
        Guid folderId,
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        var folder = await db.Folders.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == folderId, cancellationToken)
            ?? throw new NotFoundException(nameof(Folder), folderId);

        return await UploadAsync(folder.LibraryId, folder.Id, fileName, content, cancellationToken);
    }

    public async Task<(Stream Content, string FileName, string ContentType)> DownloadAsync(
        Guid documentId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Read, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        var version = await db.DocumentVersions
            .SingleAsync(item => item.Id == document.CurrentVersionId, cancellationToken);

        var stream = await storage.OpenReadAsync(version.StorageKey, cancellationToken);
        await audit.LogAsync(AuditAction.Download, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
        return (stream, document.Name, document.ContentType);
    }

    public async Task<DocumentDto> GetAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Read, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        var version = await db.DocumentVersions
            .SingleAsync(item => item.Id == document.CurrentVersionId, cancellationToken);

        return new DocumentDto(
            document.Id,
            document.LibraryId,
            document.FolderId,
            document.Name,
            document.Title,
            document.Description,
            document.ContentType,
            version.SizeBytes,
            document.CheckedOutBy,
            document.CheckedOutAt,
            document.CreatedAt,
            document.ModifiedAt,
            $"{version.VersionMajor}.{version.VersionMinor}");
    }

    public async Task DeleteAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        document.MarkDeleted(userId, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        await audit.LogAsync(AuditAction.Delete, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }

    public async Task RenameAsync(Guid documentId, string newName, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        document.Name = newName;
        document.ModifiedBy = userId;
        document.ModifiedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await audit.LogAsync(AuditAction.Rename, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }

    public async Task UpdateMetadataAsync(
        Guid documentId,
        string? title,
        string? description,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        document.Title = title;
        document.Description = description;
        document.ModifiedBy = userId;
        document.ModifiedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentVersionDto>> ListVersionsAsync(
        Guid documentId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Read, cancellationToken);

        var versions = await db.DocumentVersions.AsNoTracking()
            .Where(version => version.DocumentId == documentId)
            .OrderByDescending(version => version.VersionMajor)
            .ThenByDescending(version => version.VersionMinor)
            .ToListAsync(cancellationToken);

        return versions.Select(version => new DocumentVersionDto(
            version.Id,
            version.VersionMajor,
            version.VersionMinor,
            version.SizeBytes,
            version.Comment,
            version.IsMajor,
            version.CreatedBy,
            version.CreatedAt)).ToList();
    }

    public async Task RestoreVersionAsync(
        Guid documentId,
        Guid versionId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        var source = await db.DocumentVersions
            .SingleOrDefaultAsync(version => version.Id == versionId, cancellationToken)
            ?? throw new NotFoundException(nameof(DocumentVersion), versionId);

        var library = await db.Libraries.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == document.LibraryId, cancellationToken);
        var current = await db.DocumentVersions
            .SingleAsync(version => version.Id == document.CurrentVersionId, cancellationToken);

        var restored = new DocumentVersion
        {
            DocumentId = document.Id,
            VersionMajor = current.VersionMajor + 1,
            VersionMinor = 0,
            SizeBytes = source.SizeBytes,
            Checksum = source.Checksum,
            Comment = $"Restored from v{source.VersionMajor}.{source.VersionMinor}",
            IsMajor = true,
        };
        restored.SetCreator(userId);

        var storageKey = $"{library.SiteId}/{document.LibraryId}/{document.Id}/{restored.Id}/{document.Name}";
        restored.StorageKey = storageKey;

        await using (var sourceStream = await storage.OpenReadAsync(source.StorageKey, cancellationToken))
        {
            await storage.SaveAsync(sourceStream, storageKey, cancellationToken);
        }

        db.DocumentVersions.Add(restored);
        document.CurrentVersionId = restored.Id;
        document.ModifiedBy = userId;
        document.ModifiedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task CheckOutAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        if (document.CheckedOutBy is { } checkedOutBy && checkedOutBy != userId)
        {
            throw new ConflictException("This document is already checked out by another user.");
        }

        document.CheckedOutBy = userId;
        document.CheckedOutAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await audit.LogAsync(AuditAction.CheckOut, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }

    public async Task CheckInAsync(Guid documentId, string? comment, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        if (document.CheckedOutBy is not { } checkedOutBy)
        {
            throw new ConflictException("This document is not checked out.");
        }

        if (checkedOutBy != userId && !currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException();
        }

        document.CheckedOutBy = null;
        document.CheckedOutAt = null;
        if (comment is not null)
        {
            var current = await db.DocumentVersions
                .SingleAsync(version => version.Id == document.CurrentVersionId, cancellationToken);
            current.Comment = comment;
        }

        await db.SaveChangesAsync(cancellationToken);
        await audit.LogAsync(AuditAction.CheckIn, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }

    public async Task DiscardCheckoutAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        if (document.CheckedOutBy is { } checkedOutBy && checkedOutBy != userId && !currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException();
        }

        document.CheckedOutBy = null;
        document.CheckedOutAt = null;
        await db.SaveChangesAsync(cancellationToken);
        await audit.LogAsync(AuditAction.DiscardCheckout, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }
}
