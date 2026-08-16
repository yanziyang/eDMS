using eDMS.Domain.Common;

namespace eDMS.Domain;

/// <summary>
/// A resumable multi-part upload session (FR-DOC-12). Chunks are appended to a
/// temp file as they arrive; the session row tracks progress so a client can
/// resume after a network interruption. Sessions expire and are swept by the
/// orphaned-upload background job.
/// </summary>
public sealed class UploadSession : AuditableEntity
{
    public Guid LibraryId { get; set; }

    public Guid? FolderId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public long TotalBytes { get; set; }

    public long UploadedBytes { get; set; }

    /// <summary>
    /// Content-type column values as JSON, applied at completion (ADR-9).
    /// </summary>
    public string? MetadataJson { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }
}
