using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;

namespace eDMS.Infrastructure.Security;

/// <summary>
/// M1.7 stub: System Administrators bypass to FullControl; no hierarchy walk yet.
/// Replaced by the real recursive-CTE implementation in M2.5.
/// </summary>
public sealed class PermissionResolver(ICurrentUser currentUser) : IPermissionResolver
{
    public Task<PermissionLevel> GetEffectiveLevelAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(currentUser.IsSystemAdmin ? PermissionLevel.FullControl : PermissionLevel.NoAccess);
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
}
