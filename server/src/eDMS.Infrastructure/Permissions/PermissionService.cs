using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Permissions;
using eDMS.Application.Notifications;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Permissions;

public sealed class PermissionService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IPermissionCacheInvalidator cacheInvalidator,
    IEmailSender emailSender,
    IAuditLogger audit,
    INotificationService? notifications = null) : IPermissionService
{
    public async Task<GetPermissionsResponse> GetPermissionsAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.Read, cancellationToken);

        var unique = await db.ItemPermissions.AsNoTracking()
            .Where(permission => permission.ObjectType == objectType && permission.ObjectId == objectId)
            .ToListAsync(cancellationToken);

        var hasUniqueAcl = unique.Count != 0;
        if (!hasUniqueAcl)
        {
            var siteId = await ResolveSiteIdAsync(objectType, objectId, cancellationToken);
            var sitePermissions = await db.SitePermissions.AsNoTracking()
                .Where(permission => permission.SiteId == siteId)
                .ToListAsync(cancellationToken);

            var entries = new List<PermissionEntryDto>();
            foreach (var permission in sitePermissions)
            {
                entries.Add(new PermissionEntryDto(
                    permission.PrincipalType.ToString(),
                    permission.PrincipalId,
                    await ResolvePrincipalNameAsync(permission.PrincipalType, permission.PrincipalId, cancellationToken),
                    permission.Role.ToPermissionLevel().ToString(),
                    "Inherited"));
            }
            return new GetPermissionsResponse(false, entries);
        }

        var uniqueEntries = new List<PermissionEntryDto>();
        foreach (var permission in unique)
        {
            uniqueEntries.Add(new PermissionEntryDto(
                permission.PrincipalType.ToString(),
                permission.PrincipalId,
                await ResolvePrincipalNameAsync(permission.PrincipalType, permission.PrincipalId, cancellationToken),
                permission.Level.ToString(),
                "Direct"));
        }
        return new GetPermissionsResponse(true, uniqueEntries);
    }

    public async Task GrantAsync(
        ObjectType objectType,
        Guid objectId,
        PrincipalType principalType,
        Guid principalId,
        PermissionLevel level,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.FullControl, cancellationToken);

        var existing = await db.ItemPermissions.SingleOrDefaultAsync(
            permission => permission.ObjectType == objectType && permission.ObjectId == objectId
                && permission.PrincipalType == principalType && permission.PrincipalId == principalId,
            cancellationToken);

        if (existing is not null)
        {
            existing.Level = level;
        }
        else
        {
            db.ItemPermissions.Add(new ItemPermission
            {
                ObjectType = objectType,
                ObjectId = objectId,
                PrincipalType = principalType,
                PrincipalId = principalId,
                Level = level,
                GrantedBy = userId,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();
        await audit.LogAsync(AuditAction.PermissionChange, objectType, objectId, objectType.ToString(), null, cancellationToken);
        if (notifications is not null)
        {
            await notifications.PublishFollowedChangeAsync(
                objectType,
                objectId,
                "had a permission change",
                cancellationToken);
        }
    }

    public async Task RevokeAsync(
        ObjectType objectType,
        Guid objectId,
        PrincipalType principalType,
        Guid principalId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.FullControl, cancellationToken);

        var existing = await db.ItemPermissions.SingleOrDefaultAsync(
            permission => permission.ObjectType == objectType && permission.ObjectId == objectId
                && permission.PrincipalType == principalType && permission.PrincipalId == principalId,
            cancellationToken);
        if (existing is not null)
        {
            db.ItemPermissions.Remove(existing);
            await db.SaveChangesAsync(cancellationToken);
            cacheInvalidator.Invalidate();
            if (notifications is not null)
            {
                await notifications.PublishFollowedChangeAsync(
                    objectType,
                    objectId,
                    "had a permission change",
                    cancellationToken);
            }
        }
    }

    public async Task ResetInheritanceAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.FullControl, cancellationToken);

        var entries = await db.ItemPermissions
            .Where(permission => permission.ObjectType == objectType && permission.ObjectId == objectId)
            .ToListAsync(cancellationToken);
        db.ItemPermissions.RemoveRange(entries);
        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();
        if (notifications is not null)
        {
            await notifications.PublishFollowedChangeAsync(
                objectType,
                objectId,
                "had its inheritance reset",
                cancellationToken);
        }
    }

    public async Task ShareAsync(
        ObjectType objectType,
        Guid objectId,
        Guid principalId,
        PermissionLevel level,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.Contribute, cancellationToken);

        await GrantAsync(objectType, objectId, PrincipalType.User, principalId, level, cancellationToken);

        var user = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == principalId, cancellationToken);
        if (notifications is null && user?.Email is not null)
        {
            await emailSender.SendAsync(
                user.Email,
                "An item was shared with you",
                "<p>An item was shared with you in eDMS.</p>",
                cancellationToken);
        }

        if (notifications is not null)
        {
            await notifications.PublishSharedAsync(
                principalId,
                objectType,
                objectId,
                objectType.ToString(),
                cancellationToken);
        }

        await audit.LogAsync(AuditAction.Share, objectType, objectId, objectType.ToString(), null, cancellationToken);
    }

    private async Task<Guid> ResolveSiteIdAsync(ObjectType objectType, Guid objectId, CancellationToken cancellationToken)
    {
        return objectType switch
        {
            ObjectType.Site => objectId,
            ObjectType.Library => await db.Libraries.IgnoreQueryFilters()
                .Where(item => item.Id == objectId).Select(item => item.SiteId).SingleOrDefaultAsync(cancellationToken),
            ObjectType.Folder => await db.Folders.IgnoreQueryFilters()
                .Where(item => item.Id == objectId).Select(item => item.LibraryId)
                .Join(db.Libraries.IgnoreQueryFilters(), folder => folder, library => library.Id, (_, library) => library.SiteId)
                .SingleOrDefaultAsync(cancellationToken),
            ObjectType.Document => await db.Documents.IgnoreQueryFilters()
                .Where(item => item.Id == objectId).Select(item => item.LibraryId)
                .Join(db.Libraries.IgnoreQueryFilters(), document => document, library => library.Id, (_, library) => library.SiteId)
                .SingleOrDefaultAsync(cancellationToken),
            _ => Guid.Empty,
        };
    }

    private async Task<string> ResolvePrincipalNameAsync(
        PrincipalType principalType,
        Guid principalId,
        CancellationToken cancellationToken)
    {
        if (principalType == PrincipalType.Group)
        {
            var group = await db.Groups.AsNoTracking().SingleOrDefaultAsync(item => item.Id == principalId, cancellationToken);
            return group?.Name ?? principalId.ToString();
        }

        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == principalId, cancellationToken);
        return user?.DisplayName ?? user?.Email ?? principalId.ToString();
    }
}
