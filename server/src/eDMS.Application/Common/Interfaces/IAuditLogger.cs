using eDMS.Domain;

namespace eDMS.Application.Common.Interfaces;

public interface IAuditLogger
{
    /// <summary>
    /// Writes an audit entry for an authenticated action; the actor is resolved from
    /// <see cref="ICurrentUser"/>.
    /// </summary>
    Task LogAsync(
        AuditAction action,
        ObjectType objectType,
        Guid objectId,
        string objectName,
        Guid? siteId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Writes an auth-specific entry (Login/Logout) with an explicit actor, since the
    /// request principal is anonymous before a successful login completes.
    /// </summary>
    Task LogAuthAsync(
        Guid userId,
        AuditAction action,
        string objectName,
        CancellationToken cancellationToken = default);
}
