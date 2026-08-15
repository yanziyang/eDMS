namespace eDMS.Infrastructure.Options;

/// <summary>
/// JWT issuance configuration. <see cref="PrivateKey"/>/<see cref="PublicKey"/> are
/// PEM-encoded RSA keys supplied via configuration/secret store above local dev.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string PrivateKey { get; set; } = string.Empty;

    public string PublicKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "edms";

    public string Audience { get; set; } = "edms-api";

    public int AccessTokenLifetimeMinutes { get; set; } = 15;

    public int RefreshTokenLifetimeDays { get; set; } = 14;
}
