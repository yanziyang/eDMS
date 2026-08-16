using eDMS.Domain;

namespace eDMS.Application.Sharing;

public sealed record ShareLinkDto(Guid Id, string Token, PermissionLevel Level, DateTimeOffset? ExpiresAt);

public interface IShareLinkService
{
    Task<ShareLinkDto> CreateAsync(
        ObjectType objectType,
        Guid objectId,
        PermissionLevel level,
        DateTimeOffset? expiresAt,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ShareLinkDto>> ListAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task RevokeAsync(Guid linkId, CancellationToken cancellationToken = default);
}
