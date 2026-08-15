namespace eDMS.Domain;

/// <summary>
/// Immutable security/activity record (FR-AUDIT-04). Never updated or deleted by
/// application code; the database additionally revokes UPDATE/DELETE grants.
/// </summary>
public sealed class AuditLogEntry
{
    public Guid Id { get; set; }

    public DateTimeOffset Timestamp { get; set; }

    public Guid UserId { get; set; }

    public AuditAction Action { get; set; }

    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }

    public string ObjectName { get; set; } = string.Empty;

    public Guid? SiteId { get; set; }

    public string? Details { get; set; }

    public string? IpAddress { get; set; }
}
