using System.Security.Claims;

namespace eDMS.Infrastructure.Options;

public sealed class SamlOptions
{
    public const string SectionName = "Saml";

    public string IdpMetadataUrl { get; set; } = string.Empty;

    public string IdpEntityId { get; set; } = string.Empty;

    public string IdpSingleSignOnUrl { get; set; } = string.Empty;

    public string IdpSigningCertificate { get; set; } = string.Empty;

    public string EntityId { get; set; } = "urn:edms:saml";

    public string SigningCertificate { get; set; } = string.Empty;

    public string SigningCertificatePassword { get; set; } = string.Empty;

    public string CallbackPath { get; set; } = "/api/v1/auth/sso/saml/acs";

    public string MetadataPath { get; set; } = "/api/v1/auth/sso/saml/metadata";

    public string EmailAttributeName { get; set; } = ClaimTypes.Email;

    public bool SignAuthnRequest { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(IdpMetadataUrl)
        || (!string.IsNullOrWhiteSpace(IdpEntityId)
            && !string.IsNullOrWhiteSpace(IdpSingleSignOnUrl)
            && !string.IsNullOrWhiteSpace(IdpSigningCertificate));
}
