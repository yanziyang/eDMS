namespace eDMS.Application.Search;

public sealed record SearchResultItemDto(
    Guid DocumentId,
    string Name,
    long SizeBytes,
    Guid SiteId,
    Guid LibraryId,
    string? FolderPath,
    DateTimeOffset ModifiedAt);
