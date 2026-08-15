using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Group : AuditableEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsSystem { get; set; }

    public Guid? SiteId { get; set; }
}
