namespace eDMS.Application.Documents;

public sealed record LibraryDto(
    Guid Id,
    Guid SiteId,
    string Name,
    string? Description,
    bool EnableVersioning,
    bool EnableMinorVersions,
    bool RequireCheckout,
    int? MinorVersionsRetained);

public sealed record DocumentVersionDto(
    Guid Id,
    int VersionMajor,
    int VersionMinor,
    long SizeBytes,
    string? Comment,
    bool IsMajor,
    Guid CreatedBy,
    DateTimeOffset CreatedAt);

public sealed record DocumentDto(
    Guid Id,
    Guid LibraryId,
    Guid? FolderId,
    string Name,
    string? Title,
    string? Description,
    string ContentType,
    long SizeBytes,
    Guid? CheckedOutBy,
    DateTimeOffset? CheckedOutAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ModifiedAt,
    string VersionLabel);

public sealed record ItemDto(
    string Kind, // "folder" | "document"
    Guid Id,
    string Name,
    long SizeBytes,
    DateTimeOffset ModifiedAt,
    Guid? FolderId,
    Guid? DocumentId,
    Guid? CheckedOutBy);

public sealed record UploadResult(
    Guid DocumentId,
    string Name,
    Guid VersionId,
    string VersionLabel,
    long SizeBytes,
    string Status);
