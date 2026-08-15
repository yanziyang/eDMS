namespace eDMS.Application.Sites;

public sealed record SiteDto(
    Guid Id,
    string Name,
    string? Description,
    string UrlSlug,
    long? StorageQuotaBytes,
    long StorageUsedBytes,
    DateTimeOffset CreatedAt);
