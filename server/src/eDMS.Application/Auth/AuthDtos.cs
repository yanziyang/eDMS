namespace eDMS.Application.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record SiteMembershipDto(Guid SiteId, string SiteSlug, string Role);

public sealed record CurrentUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    bool IsSystemAdmin,
    IReadOnlyList<SiteMembershipDto> SiteMemberships);

/// <summary>
/// API response for POST /auth/login (TDS §8.2). The refresh token is deliberately
/// absent: it travels only as an httpOnly cookie, never in the JSON body.
/// </summary>
public sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, CurrentUserDto User);

public sealed record RefreshResponse(string AccessToken, int ExpiresInSeconds);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);
