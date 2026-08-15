namespace eDMS.Application.Admin;

public sealed record UserDto(
    Guid Id,
    string Email,
    string DisplayName,
    bool IsActive,
    bool IsSystemAdmin,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt);
