using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Site : SoftDeletableEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string UrlSlug { get; set; } = string.Empty;

    public long? StorageQuotaBytes { get; set; }

    public long StorageUsedBytes { get; set; }
}
