using eDMS.Domain.Common;

namespace eDMS.Domain;

/// <summary>
/// A user's alert subscription for a document or folder (FR-NOTIF-02).
/// ObjectId is intentionally polymorphic because the permission model uses the
/// same ObjectType/ObjectId pair and the target may be soft-deleted later.
/// </summary>
public sealed class AlertSubscription : AuditableEntity
{
    public Guid UserId { get; set; }

    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }

    public AlertFrequency Frequency { get; set; } = AlertFrequency.Immediate;
}
