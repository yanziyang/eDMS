using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class ItemPermission : AuditableEntity
{
    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }

    public PrincipalType PrincipalType { get; set; }

    public Guid PrincipalId { get; set; }

    public PermissionLevel Level { get; set; }

    public Guid GrantedBy { get; set; }

    public DateTimeOffset GrantedAt { get; set; } = DateTimeOffset.UtcNow;
}
