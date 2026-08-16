using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Sharing;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Sharing;

/// <summary>
/// Creates, lists, and revokes org-wide share links (FR-PERM-07). Tokens are
/// unguessable 256-bit values; resolution happens inside the permission resolver,
/// which consults the caller's presented token on every request (via
/// <c>ICurrentUser.ShareToken</c>).
/// </summary>
public sealed class ShareLinkService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IPermissionCacheInvalidator cacheInvalidator) : IShareLinkService
{
    public async Task<ShareLinkDto> CreateAsync(
        ObjectType objectType,
        Guid objectId,
        PermissionLevel level,
        DateTimeOffset? expiresAt,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.FullControl, cancellationToken);

        if (level is not (PermissionLevel.Read or PermissionLevel.Contribute))
        {
            throw new ConflictException("Share links only support Read or Contribute level.");
        }

        var link = new ShareLink
        {
            ObjectType = objectType,
            ObjectId = objectId,
            Token = CreateToken(),
            Level = level,
            RequiresAuthentication = true,
            ExpiresAt = expiresAt,
            IsRevoked = false,
        };
        link.SetCreator(userId);

        db.ShareLinks.Add(link);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(link);
    }

    public async Task<IReadOnlyList<ShareLinkDto>> ListAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.FullControl, cancellationToken);

        var links = await db.ShareLinks.AsNoTracking()
            .Where(link => link.ObjectType == objectType && link.ObjectId == objectId && !link.IsRevoked)
            .OrderByDescending(link => link.CreatedAt)
            .ToListAsync(cancellationToken);

        return links.Select(ToDto).ToList();
    }

    public async Task RevokeAsync(
        Guid linkId,
        CancellationToken cancellationToken = default)
    {
        var link = await db.ShareLinks
            .SingleOrDefaultAsync(item => item.Id == linkId, cancellationToken)
            ?? throw new NotFoundException(nameof(ShareLink), linkId);

        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, link.ObjectType, link.ObjectId, PermissionLevel.FullControl, cancellationToken);

        link.IsRevoked = true;
        await db.SaveChangesAsync(cancellationToken);

        // Revocation must block further access immediately (FR-PERM-07), so any
        // cached effective-permission results that included the link are dropped.
        cacheInvalidator.Invalidate();
    }

    internal static string CreateToken()
    {
        var bytes = new byte[32];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static ShareLinkDto ToDto(ShareLink link) =>
        new(link.Id, link.Token, link.Level, link.ExpiresAt);
}
