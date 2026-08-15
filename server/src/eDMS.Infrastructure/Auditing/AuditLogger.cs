using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;

namespace eDMS.Infrastructure.Auditing;

public sealed class AuditLogger(AppDbContext db, ICurrentUser currentUser) : IAuditLogger
{
    public Task LogAsync(
        AuditAction action,
        ObjectType objectType,
        Guid objectId,
        string objectName,
        Guid? siteId,
        CancellationToken cancellationToken = default)
    {
        return WriteAsync(currentUser.UserId, action, objectType, objectId, objectName, siteId, cancellationToken);
    }

    public Task LogAuthAsync(
        Guid userId,
        AuditAction action,
        string objectName,
        CancellationToken cancellationToken = default)
    {
        return WriteAsync(userId, action, ObjectType.User, userId, objectName, null, cancellationToken);
    }

    private async Task WriteAsync(
        Guid? userId,
        AuditAction action,
        ObjectType objectType,
        Guid objectId,
        string objectName,
        Guid? siteId,
        CancellationToken cancellationToken)
    {
        if (userId is null)
        {
            return;
        }

        db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.CreateVersion7(),
            Timestamp = DateTimeOffset.UtcNow,
            UserId = userId.Value,
            Action = action,
            ObjectType = objectType,
            ObjectId = objectId,
            ObjectName = objectName,
            SiteId = siteId,
            IpAddress = currentUser.IpAddress,
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
