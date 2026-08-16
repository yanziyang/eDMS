using eDMS.Application.Admin;
using eDMS.Application.Documents;

namespace eDMS.Application.Uploads;

public sealed record StartUploadRequest(
    Guid LibraryId,
    Guid? FolderId,
    string FileName,
    long TotalBytes,
    IReadOnlyList<ColumnValueInput>? Metadata);

public sealed record UploadSessionDto(
    Guid SessionId,
    string FileName,
    long TotalBytes,
    long UploadedBytes,
    int ChunkSize,
    DateTimeOffset ExpiresAt);

public interface IChunkedUploadService
{
    Task<UploadSessionDto> StartAsync(StartUploadRequest request, CancellationToken cancellationToken = default);

    Task<UploadSessionDto> GetStatusAsync(Guid sessionId, CancellationToken cancellationToken = default);

    Task<UploadSessionDto> AppendChunkAsync(
        Guid sessionId,
        long offset,
        Stream chunk,
        CancellationToken cancellationToken = default);

    Task<UploadResult> CompleteAsync(
        Guid sessionId,
        IReadOnlyList<ColumnValueInput>? metadata,
        CancellationToken cancellationToken = default);

    Task AbortAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
