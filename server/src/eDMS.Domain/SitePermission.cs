using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class SitePermission : AuditableEntity
{
    public Guid SiteId { get; set; }

    public PrincipalType PrincipalType { get; set; }

    public Guid PrincipalId { get; set; }

    public SiteRole Role { get; set; }
}
