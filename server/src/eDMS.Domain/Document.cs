using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Document : SoftDeletableEntity
{
    public Guid LibraryId { get; set; }

    public Guid? FolderId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Title { get; set; }

    public string? Description { get; set; }

    /// <summary>
    /// Text extracted from the current document version for full-text search.
    /// The background indexer updates this asynchronously so uploads are not
    /// blocked by PDF/Office parsing (FR-SRCH-07, ADR-13).
    /// </summary>
    public string? ExtractedText { get; set; }

    /// <summary>
    /// The document version that produced <see cref="ExtractedText"/>. A
    /// mismatch with <see cref="CurrentVersionId"/> marks the document pending
    /// for background indexing.
    /// </summary>
    public Guid? ExtractedTextVersionId { get; set; }

    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// The metadata template applied to this document (FR-META-03). Null until a
    /// content type is assigned to the document's library.
    /// </summary>
    public Guid? ContentTypeId { get; set; }

    public Guid? CurrentVersionId { get; set; }

    public Guid? CheckedOutBy { get; set; }

    public DateTimeOffset? CheckedOutAt { get; set; }

    public Guid? ModifiedBy { get; set; }

    public DateTimeOffset? ModifiedAt { get; set; }
}
