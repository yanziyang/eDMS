using eDMS.Domain.Common;

namespace eDMS.Domain;

/// <summary>
/// A non-anonymous, authentication-required share link (FR-PERM-07). Any internal
/// user who presents the token (via the X-Share-Token header) gains the link's
/// permission level on the target object without an individual ACL entry. Revoking
/// the link immediately blocks further access because the link is consulted on every
/// request, not materialized into <c>item_permissions</c>.
/// </summary>
public sealed class ShareLink : AuditableEntity
{
    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }

    public string Token { get; set; } = string.Empty;

    public PermissionLevel Level { get; set; }

    public bool RequiresAuthentication { get; set; } = true;

    public DateTimeOffset? ExpiresAt { get; set; }

    public bool IsRevoked { get; set; }
}
