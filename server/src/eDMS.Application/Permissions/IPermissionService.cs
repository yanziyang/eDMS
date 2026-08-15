using eDMS.Domain;

namespace eDMS.Application.Permissions;

public sealed record PermissionEntryDto(
    string PrincipalType,
    Guid PrincipalId,
    string PrincipalName,
    string Level,
    string Source);

public sealed record GetPermissionsResponse(bool HasUniqueAcl, IReadOnlyList<PermissionEntryDto> Entries);

public interface IPermissionService
{
    Task<GetPermissionsResponse> GetPermissionsAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task GrantAsync(
        ObjectType objectType,
        Guid objectId,
        PrincipalType principalType,
        Guid principalId,
        PermissionLevel level,
        CancellationToken cancellationToken = default);

    Task RevokeAsync(
        ObjectType objectType,
        Guid objectId,
        PrincipalType principalType,
        Guid principalId,
        CancellationToken cancellationToken = default);

    Task ResetInheritanceAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task ShareAsync(
        ObjectType objectType,
        Guid objectId,
        Guid principalId,
        PermissionLevel level,
        CancellationToken cancellationToken = default);
}
