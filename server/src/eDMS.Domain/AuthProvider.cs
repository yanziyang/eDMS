namespace eDMS.Domain;

/// <summary>
/// How an <see cref="ApplicationUser"/> authenticates. Local is the only value
/// exercised in Phase 1; Saml/Oidc are reserved for Phase 3 federation (FR-AUTH-09/10).
/// </summary>
public enum AuthProvider
{
    Local = 0,
    Saml = 1,
    Oidc = 2,
}
