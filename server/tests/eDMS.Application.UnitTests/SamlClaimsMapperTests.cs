using System.Security.Claims;
using eDMS.Application.Auth;

namespace eDMS.Application.UnitTests;

public sealed class SamlClaimsMapperTests
{
    private const string CustomEmailClaim = "urn:example:mail";

    [Fact]
    public void Maps_nameid_and_configured_email_attribute()
    {
        var identity = new ClaimsIdentity(
        [
            new Claim(CustomEmailClaim, "person@example.test"),
            new Claim("displayName", "SAML Person"),
        ]);

        var result = SamlClaimsMapper.Map(
            "idp-person-42",
            identity,
            CustomEmailClaim);

        Assert.NotNull(result);
        Assert.Equal("idp-person-42", result!.ExternalId);
        Assert.Equal("person@example.test", result.Email);
        Assert.Equal("SAML Person", result.DisplayName);
    }

    [Fact]
    public void Falls_back_to_email_when_display_name_is_missing()
    {
        var identity = new ClaimsIdentity(
        [new Claim(CustomEmailClaim, "person@example.test")]);

        var result = SamlClaimsMapper.Map("idp-person-42", identity, CustomEmailClaim);

        Assert.NotNull(result);
        Assert.Equal(result!.Email, result.DisplayName);
    }

    [Theory]
    [InlineData(null, "urn:example:mail")]
    [InlineData("idp-person-42", "urn:missing:mail")]
    [InlineData("idp-person-42", "")]
    public void Rejects_missing_required_identity_data(
        string? externalId,
        string emailAttributeName)
    {
        var identity = new ClaimsIdentity(
        [new Claim(CustomEmailClaim, "person@example.test")]);

        Assert.Null(SamlClaimsMapper.Map(externalId, identity, emailAttributeName));
    }
}
