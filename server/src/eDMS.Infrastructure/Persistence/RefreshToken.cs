namespace eDMS.Infrastructure.Persistence;

/// <summary>
/// Auth plumbing, not a domain entity (TDS §5.5). Only the SHA-256 hash of the
/// opaque refresh token is persisted; the raw value never reaches the database.
/// </summary>
public sealed class RefreshToken
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string? CreatedByIp { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public Guid? ReplacedByTokenId { get; set; }

    public RefreshToken? ReplacedByToken { get; set; }
}
