using Microsoft.AspNetCore.Identity;

namespace eDMS.Domain;

/// <summary>
/// The system's user account, extending ASP.NET Core Identity with the fields
/// required by FS §8.2. <see cref="IsSystemAdmin"/> is a plain flag rather than an
/// Identity role, matching TDS §5.5's decision to avoid a role hierarchy for a
/// single global administrator marker.
/// </summary>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public AuthProvider AuthProvider { get; set; } = AuthProvider.Local;

    public string? ExternalId { get; set; }

    public string? AvatarUrl { get; set; }

    public bool IsSystemAdmin { get; set; }

    /// <summary>
    /// When true, this account cannot authenticate with a local password and must
    /// use one of the configured federated providers.
    /// </summary>
    public bool LocalLoginDisabled { get; set; }

    /// <summary>
    /// Break-glass account flag that permits local login while global SSO enforcement
    /// is enabled. Only trusted administrator accounts should receive this flag.
    /// </summary>
    public bool SsoExempt { get; set; }

    /// <summary>
    /// When true, the user must change their password at the next login. Set on the
    /// first-run seed administrator so the configured temporary password is not left
    /// in place (TDS §6.5).
    /// </summary>
    public bool MustChangePassword { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? LastLoginAt { get; set; }
}
