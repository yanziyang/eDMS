using System.Security.Cryptography;
using System.Globalization;
using System.Text.Json;
using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using eDMS.Application.Notifications;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Documents;

public sealed class DocumentService(
    IAppDbContext db,
    IFileStorageProvider storage,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IAuditLogger audit,
    IAppSettings appSettings,
    INotificationService? notifications = null) : IDocumentService
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
        return await UploadCoreAsync(libraryId, folderId, fileName, content, null, cancellationToken);
    }

    public async Task<UploadResult> UploadAsync(
        Guid libraryId,
        Guid? folderId,
        string fileName,
        Stream content,
        IReadOnlyList<ColumnValueInput>? metadata,
        CancellationToken cancellationToken = default)
    {
        return await UploadCoreAsync(libraryId, folderId, fileName, content, metadata, cancellationToken);
    }

    private async Task<UploadResult> UploadCoreAsync(
        Guid libraryId,
        Guid? folderId,
        string fileName,
        Stream content,
        IReadOnlyList<ColumnValueInput>? metadata,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, libraryId, PermissionLevel.Contribute, cancellationToken);

        var library = await db.Libraries.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == libraryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Library), libraryId);
        var site = await db.Sites.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == library.SiteId, cancellationToken)
            ?? throw new NotFoundException(nameof(Site), library.SiteId);

        var extension = Path.GetExtension(fileName);
        if (BlockedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            throw new ConflictException($"The '{extension}' file type is blocked.");
        }

        var tempPath = Path.Combine(Path.GetTempPath(), $"edms-upload-{Guid.NewGuid():N}.tmp");
        var checksum = string.Empty;
        var sizeBytes = 0L;
        var contentType = "application/octet-stream";
        var maxUploadSizeBytes = await appSettings.GetMaxUploadSizeBytesAsync(cancellationToken);

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
                    if (sizeBytes > maxUploadSizeBytes)
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
                contentType = ContentTypeSniffer.Detect(header, fileName);
            }

            var existing = await db.Documents.IgnoreQueryFilters()
                .SingleOrDefaultAsync(document =>
                    document.LibraryId == libraryId && document.FolderId == folderId && document.Name == fileName,
                    cancellationToken);

            Document document;
            DocumentVersion version;
            var contentTypeEntity = await ResolveContentTypeForLibraryAsync(libraryId, cancellationToken);

            if (existing is not null)
            {
                if (existing.CheckedOutBy is not null && existing.CheckedOutBy != userId)
                {
                    throw new ConflictException("This document is checked out by another user.");
                }

                document = existing;
                var current = await db.DocumentVersions
                    .SingleAsync(item => item.Id == document.CurrentVersionId, cancellationToken);

                // Minor versioning (FR-VER-09): a checked-out upload completes the
                // check-in cycle, so it bumps the minor number instead of the major.
                var isMinor = library.EnableMinorVersions && existing.CheckedOutBy is not null;
                version = new DocumentVersion
                {
                    DocumentId = document.Id,
                    VersionMajor = isMinor ? current.VersionMajor : current.VersionMajor + 1,
                    VersionMinor = isMinor ? current.VersionMinor + 1 : 0,
                    SizeBytes = sizeBytes,
                    Checksum = checksum,
                    IsMajor = !isMinor,
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
                    ContentTypeId = contentTypeEntity?.Id,
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

            if (contentTypeEntity is not null && metadata is { Count: > 0 })
            {
                foreach (var input in metadata)
                {
                    db.DocumentColumnValues.Add(new DocumentColumnValue
                    {
                        DocumentId = document.Id,
                        ColumnDefinitionId = input.ColumnDefinitionId,
                        Value = input.Value ?? string.Empty,
                    });
                }
            }

            // Required-column enforcement at upload time evaluates the metadata
            // provided in this request plus any values already persisted for the
            // document (the new rows are not yet saved, so the DB cannot see them).
            if (contentTypeEntity is not null)
            {
                var requiredColumns = await db.ColumnDefinitions.AsNoTracking()
                    .Where(column => column.ContentTypeId == contentTypeEntity.Id && column.IsRequired)
                    .ToListAsync(cancellationToken);
                if (requiredColumns.Count != 0)
                {
                    var provided = (metadata ?? [])
                        .ToDictionary(input => input.ColumnDefinitionId, input => input.Value ?? string.Empty);
                    var existingValues = existing is null
                        ? new Dictionary<Guid, string>()
                        : await db.DocumentColumnValues
                            .Where(value => value.DocumentId == document.Id)
                            .ToDictionaryAsync(value => value.ColumnDefinitionId, value => value.Value, cancellationToken);

                    var missing = requiredColumns
                        .Where(column =>
                            !HasValue(provided, column.Id) && !HasValue(existingValues, column.Id))
                        .Select(column => column.Name)
                        .ToList();
                    if (missing.Count != 0)
                    {
                        throw new ConflictException(
                            $"Missing required metadata: {string.Join(", ", missing)}.");
                    }
                }
            }

            EnsureQuotaAvailable(site, sizeBytes);

            var storageKey = $"{library.SiteId}/{libraryId}/{document.Id}/{version.Id}/{fileName}";
            version.StorageKey = storageKey;
            db.DocumentVersions.Add(version);

            document.CurrentVersionId = version.Id;
            document.ContentType = contentType;
            document.ModifiedBy = userId;
            document.ModifiedAt = DateTimeOffset.UtcNow;
            site.StorageUsedBytes = checked(site.StorageUsedBytes + sizeBytes);

            await db.SaveChangesAsync(cancellationToken);

            await TrimMinorVersionsAsync(document.Id, site.Id, library.MinorVersionsRetained, cancellationToken);

            await using var fileStream = File.OpenRead(tempPath);
            await storage.SaveAsync(fileStream, storageKey, cancellationToken);

            await audit.LogAsync(AuditAction.Upload, ObjectType.Document, document.Id, document.Name, library.SiteId, cancellationToken);

            if (notifications is not null)
            {
                await notifications.PublishFollowedChangeAsync(
                    ObjectType.Document,
                    document.Id,
                    "received a new version",
                    cancellationToken);
            }

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

        await audit.LogAsync(AuditAction.View, ObjectType.Document, document.Id, document.Name, null, cancellationToken);

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
        if (notifications is not null)
        {
            await notifications.PublishFollowedChangeAsync(
                ObjectType.Document,
                document.Id,
                "was deleted",
                cancellationToken);
        }
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
        if (notifications is not null)
        {
            await notifications.PublishFollowedChangeAsync(
                ObjectType.Document,
                document.Id,
                "was renamed",
                cancellationToken);
        }
        await audit.LogAsync(AuditAction.EditMetadata, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
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
        await audit.LogAsync(AuditAction.Restore, ObjectType.Document, document.Id, document.Name, null, cancellationToken);
    }

    public async Task<BulkMetadataUpdateResult> BulkUpdateMetadataAsync(
        BulkMetadataUpdateRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var documents = await db.Documents
            .Where(document => request.DocumentIds.Contains(document.Id))
            .ToDictionaryAsync(document => document.Id, cancellationToken);
        var results = new List<BulkMetadataUpdateItem>(request.DocumentIds.Count);

        foreach (var documentId in request.DocumentIds)
        {
            if (!documents.TryGetValue(documentId, out var document))
            {
                results.Add(Rejected(documentId, "not-found"));
                continue;
            }

            try
            {
                await permissions.RequireAsync(
                    userId,
                    ObjectType.Document,
                    documentId,
                    PermissionLevel.Contribute,
                    cancellationToken);
            }
            catch (ForbiddenException)
            {
                results.Add(Rejected(documentId, "forbidden"));
                continue;
            }

            if (document.CheckedOutBy is { } checkedOutBy && checkedOutBy != userId)
            {
                results.Add(Rejected(documentId, "checked-out-by-other-user"));
                continue;
            }

            var definitions = document.ContentTypeId is { } contentTypeId
                ? await db.ColumnDefinitions
                    .Where(column => column.ContentTypeId == contentTypeId)
                    .ToListAsync(cancellationToken)
                : [];
            var invalidColumn = request.Columns
                .Select(input => (Input: input, Definition: definitions.FirstOrDefault(column =>
                    string.Equals(column.Name, input.Name, StringComparison.OrdinalIgnoreCase))))
                .FirstOrDefault(item => item.Definition is not null
                    && !IsValidBulkColumnValue(item.Definition, item.Input.Value));
            if (invalidColumn.Definition is not null)
            {
                results.Add(Rejected(documentId, "invalid-metadata"));
                continue;
            }

            if (request.UpdateTitle)
            {
                document.Title = request.Title;
            }

            if (request.UpdateDescription)
            {
                document.Description = request.Description;
            }

            if (request.UpdateTags)
            {
                await ReplaceTagsAsync(document.Id, request.Tags ?? [], userId, cancellationToken);
            }

            if (request.Columns.Count > 0 && definitions.Count > 0)
            {
                var values = await db.DocumentColumnValues
                    .Where(value => value.DocumentId == document.Id)
                    .ToListAsync(cancellationToken);
                foreach (var input in request.Columns)
                {
                    var definition = definitions.FirstOrDefault(column =>
                        string.Equals(column.Name, input.Name, StringComparison.OrdinalIgnoreCase));
                    if (definition is null)
                    {
                        continue;
                    }

                    var existing = values.SingleOrDefault(value => value.ColumnDefinitionId == definition.Id);
                    if (existing is null)
                    {
                        db.DocumentColumnValues.Add(new DocumentColumnValue
                        {
                            DocumentId = document.Id,
                            ColumnDefinitionId = definition.Id,
                            Value = input.Value ?? string.Empty,
                        });
                    }
                    else
                    {
                        existing.Value = input.Value ?? string.Empty;
                    }
                }
            }

            document.ModifiedBy = userId;
            document.ModifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            await audit.LogAsync(
                AuditAction.EditMetadata,
                ObjectType.Document,
                document.Id,
                document.Name,
                null,
                cancellationToken);
            results.Add(new BulkMetadataUpdateItem(document.Id, "updated", null));
        }

        return new BulkMetadataUpdateResult(results);
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
        var site = await db.Sites.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == library.SiteId, cancellationToken);
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
        EnsureQuotaAvailable(site, restored.SizeBytes);

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
        site.StorageUsedBytes = checked(site.StorageUsedBytes + restored.SizeBytes);
        await db.SaveChangesAsync(cancellationToken);
        if (notifications is not null)
        {
            await notifications.PublishFollowedChangeAsync(
                ObjectType.Document,
                document.Id,
                "received a restored version",
                cancellationToken);
        }
    }

    public async Task<Guid> MoveAsync(
        Guid documentId,
        Guid destinationLibraryId,
        Guid? destinationFolderId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Contribute, cancellationToken);
        await permissions.RequireAsync(userId, ObjectType.Library, destinationLibraryId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        var destinationLibrary = await ValidateDestinationAsync(
            document.LibraryId,
            destinationLibraryId,
            destinationFolderId,
            cancellationToken);
        var sourceLibrary = await db.Libraries.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == document.LibraryId, cancellationToken);
        var sourceSite = await db.Sites.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == sourceLibrary.SiteId, cancellationToken);
        var destinationSite = sourceSite.Id == destinationLibrary.SiteId
            ? sourceSite
            : await db.Sites.IgnoreQueryFilters()
                .SingleAsync(item => item.Id == destinationLibrary.SiteId, cancellationToken);
        var crossSite = sourceSite.Id != destinationSite.Id;
        var storageMoves = new List<(string OldKey, string NewKey)>();
        var movedBytes = 0L;

        if (crossSite)
        {
            var versions = await db.DocumentVersions
                .Where(version => version.DocumentId == document.Id)
                .ToListAsync(cancellationToken);
            movedBytes = versions.Sum(version => version.SizeBytes);
            EnsureQuotaAvailable(destinationSite, movedBytes);

            try
            {
                foreach (var version in versions)
                {
                    var newKey = $"{destinationSite.Id}/{destinationLibrary.Id}/{document.Id}/{version.Id}/{document.Name}";
                    await CopyStorageAsync(version.StorageKey, newKey, cancellationToken);
                    storageMoves.Add((version.StorageKey, newKey));
                    version.StorageKey = newKey;
                }
            }
            catch
            {
                foreach (var (_, newKey) in storageMoves)
                {
                    await storage.DeleteAsync(newKey, cancellationToken);
                }

                throw;
            }
        }

        document.LibraryId = destinationLibraryId;
        document.FolderId = destinationFolderId;
        document.ModifiedBy = userId;
        document.ModifiedAt = DateTimeOffset.UtcNow;
        if (crossSite)
        {
            sourceSite.StorageUsedBytes = Math.Max(0, sourceSite.StorageUsedBytes - movedBytes);
            destinationSite.StorageUsedBytes = checked(destinationSite.StorageUsedBytes + movedBytes);
        }

        await db.SaveChangesAsync(cancellationToken);
        foreach (var (oldKey, _) in storageMoves)
        {
            await storage.DeleteAsync(oldKey, cancellationToken);
        }

        await audit.LogAsync(
            AuditAction.Move,
            ObjectType.Document,
            document.Id,
            document.Name,
            destinationSite.Id,
            cancellationToken);
        return document.Id;
    }

    public async Task<Guid> CopyAsync(
        Guid documentId,
        Guid destinationLibraryId,
        Guid? destinationFolderId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Document, documentId, PermissionLevel.Read, cancellationToken);
        await permissions.RequireAsync(userId, ObjectType.Library, destinationLibraryId, PermissionLevel.Contribute, cancellationToken);

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == documentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), documentId);

        var sourceVersion = await db.DocumentVersions
            .SingleAsync(version => version.Id == document.CurrentVersionId, cancellationToken);

        var destinationLibrary = await ValidateDestinationAsync(
            document.LibraryId,
            destinationLibraryId,
            destinationFolderId,
            cancellationToken);

        var nameTaken = await db.Documents.IgnoreQueryFilters().AnyAsync(
            item => item.LibraryId == destinationLibraryId
                && item.FolderId == destinationFolderId
                && item.Name == document.Name,
            cancellationToken);
        if (nameTaken)
        {
            throw new ConflictException("A document with this name already exists in the destination folder.");
        }

        var copy = new Document
        {
            LibraryId = destinationLibraryId,
            FolderId = destinationFolderId,
            Name = document.Name,
            Title = document.Title,
            Description = document.Description,
            ContentType = document.ContentType,
            ContentTypeId = document.ContentTypeId,
        };
        copy.SetCreator(userId);

        var newVersion = new DocumentVersion
        {
            DocumentId = copy.Id,
            VersionMajor = 1,
            VersionMinor = 0,
            SizeBytes = sourceVersion.SizeBytes,
            Checksum = sourceVersion.Checksum,
            IsMajor = true,
        };
        newVersion.SetCreator(userId);

        var destinationSite = await db.Sites.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == destinationLibrary.SiteId, cancellationToken);
        EnsureQuotaAvailable(destinationSite, sourceVersion.SizeBytes);
        var storageKey = $"{destinationLibrary.SiteId}/{destinationLibraryId}/{copy.Id}/{newVersion.Id}/{document.Name}";
        newVersion.StorageKey = storageKey;

        copy.CurrentVersionId = newVersion.Id;
        destinationSite.StorageUsedBytes = checked(destinationSite.StorageUsedBytes + newVersion.SizeBytes);
        db.Documents.Add(copy);
        db.DocumentVersions.Add(newVersion);
        await db.SaveChangesAsync(cancellationToken);

        await using (var sourceStream = await storage.OpenReadAsync(sourceVersion.StorageKey, cancellationToken))
        {
            await storage.SaveAsync(sourceStream, storageKey, cancellationToken);
        }

        await audit.LogAsync(AuditAction.Copy, ObjectType.Document, copy.Id, copy.Name, destinationLibrary.SiteId, cancellationToken);
        return copy.Id;
    }

    private async Task<ContentType?> ResolveContentTypeForLibraryAsync(
        Guid libraryId,
        CancellationToken cancellationToken)
    {
        var libraryType = await db.ContentTypes.AsNoTracking()
            .Where(contentType => contentType.LibraryId == libraryId)
            .OrderBy(contentType => contentType.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (libraryType is not null)
        {
            return libraryType;
        }

        // Fall back to the org-wide reusable type only when there is exactly one.
        var orgWide = await db.ContentTypes.AsNoTracking()
            .Where(contentType => contentType.LibraryId == null)
            .ToListAsync(cancellationToken);
        return orgWide.Count == 1 ? orgWide[0] : null;
    }

    private static bool HasValue(IReadOnlyDictionary<Guid, string> values, Guid columnId) =>
        values.TryGetValue(columnId, out var value) && !string.IsNullOrWhiteSpace(value);

    private async Task ReplaceTagsAsync(
        Guid documentId,
        IReadOnlyList<string> tags,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var normalizedTags = tags
            .Select(tag => tag.Trim())
            .Where(tag => tag.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var current = await db.DocumentTags
            .Where(tag => tag.DocumentId == documentId)
            .ToListAsync(cancellationToken);
        db.DocumentTags.RemoveRange(current);

        var existingTags = await db.Tags
            .Where(tag => normalizedTags.Contains(tag.Name))
            .ToListAsync(cancellationToken);
        foreach (var name in normalizedTags)
        {
            var tag = existingTags.FirstOrDefault(existing =>
                string.Equals(existing.Name, name, StringComparison.OrdinalIgnoreCase));
            if (tag is null)
            {
                tag = new Tag { Name = name };
                tag.SetCreator(userId);
                db.Tags.Add(tag);
            }

            db.DocumentTags.Add(new DocumentTag { DocumentId = documentId, TagId = tag.Id });
        }
    }

    private static bool IsValidBulkColumnValue(ColumnDefinition definition, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return !definition.IsRequired;
        }

        return definition.DataType switch
        {
            ColumnDataType.Number => decimal.TryParse(
                value,
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out _),
            ColumnDataType.Date => DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out _),
            ColumnDataType.Boolean => bool.TryParse(value, out _),
            ColumnDataType.Choice => IsChoiceValue(definition.ChoiceOptions, value),
            _ => true,
        };
    }

    private static bool IsChoiceValue(string? optionsJson, string value)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
        {
            return false;
        }

        try
        {
            var options = JsonSerializer.Deserialize<List<string>>(optionsJson) ?? [];
            return options.Contains(value, StringComparer.Ordinal);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static BulkMetadataUpdateItem Rejected(Guid documentId, string reason) =>
        new(documentId, "rejected", reason);

    private async Task<List<string>> MissingRequiredColumnsAsync(
        Guid? contentTypeId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        if (contentTypeId is not { } id)
        {
            return [];
        }

        var required = await db.ColumnDefinitions.AsNoTracking()
            .Where(column => column.ContentTypeId == id && column.IsRequired)
            .Select(column => column.Id)
            .ToListAsync(cancellationToken);
        if (required.Count == 0)
        {
            return [];
        }

        var values = await db.DocumentColumnValues
            .Where(value => value.DocumentId == documentId)
            .ToDictionaryAsync(value => value.ColumnDefinitionId, value => value.Value, cancellationToken);

        return required
            .Where(columnId => !values.TryGetValue(columnId, out var value) || string.IsNullOrWhiteSpace(value))
            .Select(columnId => db.ColumnDefinitions.AsNoTracking()
                .First(column => column.Id == columnId).Name)
            .ToList();
    }

    private async Task TrimMinorVersionsAsync(
        Guid documentId,
        Guid siteId,
        int? cap,
        CancellationToken cancellationToken)
    {
        if (cap is not { } retained || retained <= 0)
        {
            return;
        }

        // Keep the newest `retained` minor versions; majors are never trimmed.
        var minors = await db.DocumentVersions.AsNoTracking()
            .Where(version => version.DocumentId == documentId && !version.IsMajor)
            .OrderByDescending(version => version.VersionMajor)
            .ThenByDescending(version => version.VersionMinor)
            .ToListAsync(cancellationToken);

        var toRemove = minors.Skip(retained).ToList();
        if (toRemove.Count == 0)
        {
            return;
        }

        var keys = toRemove.Select(version => version.StorageKey).ToList();
        var tracked = await db.DocumentVersions
            .Where(version => toRemove.Select(item => item.Id).Contains(version.Id))
            .ToListAsync(cancellationToken);
        db.DocumentVersions.RemoveRange(tracked);
        var site = await db.Sites.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == siteId, cancellationToken);
        site.StorageUsedBytes = Math.Max(0, site.StorageUsedBytes - toRemove.Sum(version => version.SizeBytes));
        await db.SaveChangesAsync(cancellationToken);

        foreach (var key in keys)
        {
            await storage.DeleteAsync(key, cancellationToken);
        }
    }

    private async Task<Library> ValidateDestinationAsync(
        Guid sourceLibraryId,
        Guid destinationLibraryId,
        Guid? destinationFolderId,
        CancellationToken cancellationToken)
    {
        var destinationLibrary = await db.Libraries.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == destinationLibraryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Library), destinationLibraryId);

        if (destinationFolderId is { } folderId)
        {
            var folder = await db.Folders.IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.Id == folderId, cancellationToken)
                ?? throw new NotFoundException(nameof(Folder), folderId);
            if (folder.LibraryId != destinationLibraryId)
            {
                throw new ConflictException("The destination folder does not belong to the destination library.");
            }
        }

        _ = sourceLibraryId;
        return destinationLibrary;
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

        var librarySiteId = await db.Libraries.IgnoreQueryFilters()
            .Where(item => item.Id == document.LibraryId)
            .Select(item => item.SiteId)
            .SingleAsync(cancellationToken);
        var site = await db.Sites.IgnoreQueryFilters()
            .SingleAsync(item => item.Id == librarySiteId, cancellationToken);

        // The explicit check-in endpoint releases the lock; the checked-out
        // upload that precedes it is the operation that creates and accounts for
        // the new version. Still fail closed if the Site is already over quota.
        EnsureQuotaAvailable(site, 0);

        var missingColumns = await MissingRequiredColumnsAsync(document.ContentTypeId, document.Id, cancellationToken);
        if (missingColumns.Count != 0)
        {
            throw new ConflictException(
                $"Missing required metadata: {string.Join(", ", missingColumns)}.");
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

    private static void EnsureQuotaAvailable(Site site, long incomingBytes)
    {
        if (site.StorageQuotaBytes is { } quota
            && StorageQuotaPolicy.WouldExceed(site.StorageUsedBytes, incomingBytes, quota))
        {
            throw new QuotaExceededException(
                site.Name,
                quota,
                site.StorageUsedBytes,
                incomingBytes);
        }
    }

    private async Task CopyStorageAsync(
        string sourceKey,
        string destinationKey,
        CancellationToken cancellationToken)
    {
        await using var sourceStream = await storage.OpenReadAsync(sourceKey, cancellationToken);
        await storage.SaveAsync(sourceStream, destinationKey, cancellationToken);
    }
}
