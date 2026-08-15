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

    Task<RefreshAuthResult> RefreshAsync(
        string refreshToken,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken);

    Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken);
}
