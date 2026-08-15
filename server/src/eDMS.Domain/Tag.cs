using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Tag : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
}
