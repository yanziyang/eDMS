using eDMS.Application.Common.Interfaces;

namespace eDMS.Application.Auth;

public sealed record AuthResult(CurrentUserDto User, TokenPair Tokens, int ExpiresInSeconds);

public sealed record RefreshAuthResult(
    RefreshTokenRotationStatus Status,
    TokenPair? TokenPair,
    int ExpiresInSeconds);

public interface IAuthService
{
    /// <summary>
    /// Verifies credentials and issues a token pair, or returns null when the
    /// account is unknown, inactive, locked out, or the password is wrong.
    /// </summary>
    Task<AuthResult?> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken cancellationToken);

    Task<AuthResult?> CompleteSsoExchangeAsync(
        string code,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<RefreshAuthResult> RefreshAsync(
        string refreshToken,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken);

    Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Generates a single-use reset token and emails a link. Returns without error for
    /// unknown/inactive accounts to avoid revealing account existence (FR-AUTH-04).
    /// </summary>
    Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken);

    Task<bool> ResetPasswordAsync(
        string email,
        string token,
        string newPassword,
        CancellationToken cancellationToken);
}
