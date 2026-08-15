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
}
