namespace eDMS.Application.Admin;

public sealed record UserDto(
    Guid Id,
    string Email,
    string DisplayName,
    bool IsActive,
    bool IsSystemAdmin,
    bool LocalLoginDisabled,
    bool SsoExempt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt);
