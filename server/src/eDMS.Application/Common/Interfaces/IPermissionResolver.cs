using eDMS.Domain;

namespace eDMS.Application.Common.Interfaces;

public interface IPermissionResolver
{
    Task<PermissionLevel> GetEffectiveLevelAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        CancellationToken cancellationToken = default);

    /// <summary>Throws <see cref="Common.Exceptions.ForbiddenException"/> when the level is insufficient.</summary>
    Task RequireAsync(
        Guid userId,
        ObjectType type,
        Guid objectId,
        PermissionLevel required,
        CancellationToken cancellationToken = default);
}
