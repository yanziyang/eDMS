namespace eDMS.Infrastructure.Options;

public sealed class OidcOptions
{
    public const string SectionName = "Oidc";

    public string Authority { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    public string CallbackPath { get; set; } = "/api/v1/auth/sso/oidc/callback";

    public bool RequireHttpsMetadata { get; set; } = true;
}
