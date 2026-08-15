using eDMS.Domain;

namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Implemented by a request whose successful execution must be recorded in the audit
/// log by <see cref="Common.Behaviors.AuditLoggingBehavior{TRequest,TResponse}"/>.
/// </summary>
public interface IAuditableRequest
{
    AuditAction AuditAction { get; }

    ObjectType ObjectType { get; }

    Guid ObjectId { get; }

    string ObjectName { get; }

    Guid? SiteId { get; }
}
