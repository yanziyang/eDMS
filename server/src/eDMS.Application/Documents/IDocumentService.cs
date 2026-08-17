using eDMS.Application.Admin;

namespace eDMS.Application.Documents;

public interface IDocumentService
{
    Task<IReadOnlyList<ItemDto>> ListAsync(
        Guid libraryId,
        Guid? folderId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ItemDto>> ListFolderAsync(Guid folderId, CancellationToken cancellationToken = default);

    Task<UploadResult> UploadAsync(
        Guid libraryId,
        Guid? folderId,
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default);

    Task<UploadResult> UploadAsync(
        Guid libraryId,
        Guid? folderId,
        string fileName,
        Stream content,
        IReadOnlyList<ColumnValueInput>? metadata,
        CancellationToken cancellationToken = default);

    Task<UploadResult> UploadToFolderAsync(
        Guid folderId,
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default);

    Task<(Stream Content, string FileName, string ContentType)> DownloadAsync(
        Guid documentId,
        CancellationToken cancellationToken = default);

    Task<DocumentDto> GetAsync(Guid documentId, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid documentId, CancellationToken cancellationToken = default);

    Task RenameAsync(Guid documentId, string newName, CancellationToken cancellationToken = default);

    Task UpdateMetadataAsync(
        Guid documentId,
        string? title,
        string? description,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DocumentVersionDto>> ListVersionsAsync(
        Guid documentId,
        CancellationToken cancellationToken = default);

    Task RestoreVersionAsync(Guid documentId, Guid versionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves a document to another folder/library (FR-DOC-06). The version history
    /// travels with the document; a cross-Site move transfers its stored bytes.
    /// </summary>
    Task<Guid> MoveAsync(
        Guid documentId,
        Guid destinationLibraryId,
        Guid? destinationFolderId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Copies the current version of a document to another folder/library as a new
    /// Document at v1.0 with no link to the source (FR-DOC-06).
    /// Returns the new document id.
    /// </summary>
    Task<Guid> CopyAsync(
        Guid documentId,
        Guid destinationLibraryId,
        Guid? destinationFolderId,
        CancellationToken cancellationToken = default);

    Task CheckOutAsync(Guid documentId, CancellationToken cancellationToken = default);

    Task CheckInAsync(Guid documentId, string? comment, CancellationToken cancellationToken = default);

    Task DiscardCheckoutAsync(Guid documentId, CancellationToken cancellationToken = default);
}
