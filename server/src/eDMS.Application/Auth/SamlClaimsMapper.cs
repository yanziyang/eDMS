using System.Security.Claims;

namespace eDMS.Application.Auth;

public sealed record SamlIdentityMapping(
    string ExternalId,
    string Email,
    string DisplayName);

public static class SamlClaimsMapper
{
    public static SamlIdentityMapping? Map(
        string? externalId,
        ClaimsIdentity? identity,
        string emailAttributeName)
    {
        if (string.IsNullOrWhiteSpace(externalId)
            || string.IsNullOrWhiteSpace(emailAttributeName))
        {
            return null;
        }

        var email = FindClaim(identity, emailAttributeName);
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var displayName = FindClaim(
                identity,
                ClaimTypes.Name,
                "name",
                "displayName")
            ?? email;

        return new SamlIdentityMapping(externalId, email, displayName);
    }

    private static string? FindClaim(
        ClaimsIdentity? identity,
        params string[] claimTypes) =>
        claimTypes
            .Select(type => identity?.FindFirst(type)?.Value)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
}
