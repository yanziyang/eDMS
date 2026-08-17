using eDMS.Domain.Common;

namespace eDMS.Domain;

/// <summary>
/// A durable in-app inbox entry. EmailSentAt is also the delivery watermark for
/// the digest worker; the row remains available for the bell until the user reads it.
/// </summary>
public sealed class Notification : AuditableEntity
{
    public Guid UserId { get; set; }

    public NotificationKind Kind { get; set; }

    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }

    public string ObjectName { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Frequency copied from the subscription at event time. Shared-with-me rows
    /// always use Immediate, while followed-item rows use the user's selection.
    /// </summary>
    public AlertFrequency Frequency { get; set; }

    public bool IsRead { get; set; }

    public DateTimeOffset? ReadAt { get; set; }

    public DateTimeOffset? EmailSentAt { get; set; }
}
