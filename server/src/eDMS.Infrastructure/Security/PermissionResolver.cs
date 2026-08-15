using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace eDMS.Infrastructure.Security;

/// <summary>
/// Resolves effective permission by walking the object to its Site, then evaluating
/// <c>site_permissions</c> (direct user grants plus grants via group membership). A
/// 30-second <see cref="IMemoryCache"/> is invalidated on every permission mutation via
/// <see cref="IPermissionCacheInvalidator"/>. Folder/document/item-level walks are added
/// in M3/M5 when those entities land.
/// </summary>
public sealed class PermissionResolver(
    AppDbContext db,
    ICurrentUser currentUser,
    IMemoryCache cache,
    IPermissionCacheInvalidator invalidator) : IPermissionResolver
{
    public async Task<PermissionLevel> GetEffectiveLevelAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        if (currentUser.IsSystemAdmin)
        {
            return PermissionLevel.FullControl;
        }

        var key = $"perm:{userId}:{type}:{objectId}:{invalidator.Generation}";
        return await cache.GetOrCreateAsync(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            return ResolveAsync(userId, type, objectId, cancellationToken);
        });
    }

    public async Task RequireAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        PermissionLevel required,
        CancellationToken cancellationToken = default)
    {
        var granted = await GetEffectiveLevelAsync(userId, type, objectId, cancellationToken);
        if (granted > required)
        {
            throw new ForbiddenException();
        }
    }

    private async Task<PermissionLevel> ResolveAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken)
    {
        var siteId = type switch
        {
            ObjectType.Site => objectId,
            ObjectType.Library => await db.Libraries.IgnoreQueryFilters()
                .Where(library => library.Id == objectId)
                .Select(library => library.SiteId)
                .SingleOrDefaultAsync(cancellationToken),
            _ => Guid.Empty, // Folder/Document resolution lands with M3/M5.
        };

        return siteId == Guid.Empty
            ? PermissionLevel.NoAccess
            : await ResolveSiteLevelAsync(userId, siteId, cancellationToken);
    }

    private async Task<PermissionLevel> ResolveSiteLevelAsync(
        Guid userId,
        Guid siteId,
        CancellationToken cancellationToken)
    {
        var directRoles = await db.SitePermissions
            .Where(permission => permission.SiteId == siteId
                && permission.PrincipalType == PrincipalType.User
                && permission.PrincipalId == userId)
            .Select(permission => (int)permission.Role)
            .ToListAsync(cancellationToken);

        var groupRoles = await db.SitePermissions
            .Where(permission => permission.SiteId == siteId
                && permission.PrincipalType == PrincipalType.Group)
            .Join(
                db.GroupMembers,
                permission => permission.PrincipalId,
                member => member.GroupId,
                (permission, member) => new { permission.Role, member.UserId })
            .Where(joined => joined.UserId == userId)
            .Select(joined => (int)joined.Role)
            .ToListAsync(cancellationToken);

        var roles = directRoles.Concat(groupRoles).ToList();
        return roles.Count == 0
            ? PermissionLevel.NoAccess
            : ((SiteRole)roles.Min()).ToPermissionLevel();
    }
}
