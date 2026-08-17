namespace eDMS.Infrastructure.Persistence;

/// <summary>
/// One-time SSO exchange state. The raw code is never persisted; only its
/// SHA-256 hash is stored, like refresh token state.
/// </summary>
public sealed class SsoHandoffCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string CodeHash { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }
}
