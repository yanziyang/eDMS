namespace eDMS.Application.Admin;

public interface IUserManagementService
{
    Task<IReadOnlyList<UserDto>> ListAsync(string? search, CancellationToken cancellationToken = default);

    Task<Guid> CreateAsync(
        string email,
        string displayName,
        string tempPassword,
        bool isSystemAdmin,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(
        Guid userId,
        string displayName,
        bool isSystemAdmin,
        CancellationToken cancellationToken = default);

    Task SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default);
}
