using eDMS.Api.Auth;
using eDMS.Api.Controllers;
using eDMS.Application.Auth;
using eDMS.Infrastructure.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class SsoControllerTests
{
    [Fact]
    public void Providers_hide_unconfigured_oidc()
    {
        var controller = new SsoController(Options.Create(new OidcOptions()));

        var result = Assert.IsType<OkObjectResult>(controller.Providers());
        var providers = Assert.IsType<SsoProvidersResponse>(result.Value);

        Assert.False(providers.Oidc);
        Assert.False(providers.Saml);
    }

    [Fact]
    public void Providers_report_configured_oidc()
    {
        var controller = new SsoController(Options.Create(new OidcOptions
        {
            Authority = "https://idp.example.test",
            ClientId = "edms",
        }));

        var result = Assert.IsType<OkObjectResult>(controller.Providers());
        var providers = Assert.IsType<SsoProvidersResponse>(result.Value);

        Assert.True(providers.Oidc);
        Assert.False(providers.Saml);
    }

    [Fact]
    public void Challenge_is_not_available_when_oidc_is_unconfigured()
    {
        var controller = new SsoController(Options.Create(new OidcOptions()));

        Assert.IsType<NotFoundResult>(controller.OidcChallenge());
    }

    [Fact]
    public void Challenge_uses_the_named_oidc_scheme_when_configured()
    {
        var controller = new SsoController(Options.Create(new OidcOptions
        {
            Authority = "https://idp.example.test",
        }));

        var result = Assert.IsType<ChallengeResult>(controller.OidcChallenge());

        Assert.Equal(SsoAuthenticationSchemes.Oidc, Assert.Single(result.AuthenticationSchemes));
    }
}
