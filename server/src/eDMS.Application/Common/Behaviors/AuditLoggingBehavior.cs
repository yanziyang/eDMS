using eDMS.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace eDMS.Application.Common.Behaviors;

/// <summary>
/// Writes the audit entry after a successful handler execution, as a separate
/// save (TDS §10.5). An audit-write failure does not roll back the mutation, but it
/// is surfaced to Serilog so a gap is operationally visible.
/// </summary>
public sealed class AuditLoggingBehavior<TRequest, TResponse>(
    IAuditLogger audit,
    ICurrentUser currentUser,
    ILogger<AuditLoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var response = await next();

        if (request is IAuditableRequest auditable && currentUser.UserId is { } userId)
        {
            try
            {
                await audit.LogAsync(
                    auditable.AuditAction,
                    auditable.ObjectType,
                    auditable.ObjectId,
                    auditable.ObjectName,
                    auditable.SiteId,
                    cancellationToken);
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Failed to write audit entry for action {Action} on {ObjectType} {ObjectId}.",
                    auditable.AuditAction,
                    auditable.ObjectType,
                    auditable.ObjectId);
            }
        }

        return response;
    }
}
