using eDMS.Domain;

namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// An access/refresh token pair returned on successful authentication or rotation.
/// The refresh token is opaque and is the only copy the client ever receives; the
/// server persists only its hash (TDS §5.5).
/// </summary>
public sealed record TokenPair(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

public enum RefreshTokenRotationStatus
{
    Success,
    Invalid,
    ReuseDetected,
}

public sealed record RefreshTokenRotationResult(
    RefreshTokenRotationStatus Status,
    TokenPair? TokenPair);

public interface ITokenService
{
    /// <summary>
    /// Issues a fresh RS256 access token and a new opaque refresh token (hash-only
    /// storage) for the given user.
    /// </summary>
    Task<TokenPair> IssueTokenPairAsync(
        ApplicationUser user,
        string? ipAddress,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Rotates a presented refresh token. Reuse of an already-rotated token revokes
    /// the whole chain and reports <see cref="RefreshTokenRotationStatus.ReuseDetected"/>.
    /// </summary>
    Task<RefreshTokenRotationResult> RotateAsync(
        string refreshToken,
        string? ipAddress,
        CancellationToken cancellationToken = default);

    Task RevokeAsync(
        string refreshToken,
        CancellationToken cancellationToken = default);

    Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
