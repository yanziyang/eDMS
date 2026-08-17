using System.Security.Claims;
using eDMS.Api.Auth;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.MvcCore;
using ITfoxtec.Identity.Saml2.Schemas;
using ITfoxtec.Identity.Saml2.Schemas.Metadata;
using System.Security.Cryptography.X509Certificates;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/auth/sso")]
public sealed class SsoController(
    IOptions<OidcOptions> oidcOptions,
    IOptions<SamlOptions> samlOptions) : ControllerBase
{
    [HttpGet("providers")]
    [AllowAnonymous]
    public IActionResult Providers()
    {
        return Ok(new SsoProvidersResponse(
            Oidc: IsOidcConfigured(oidcOptions.Value),
            Saml: samlOptions.Value.IsConfigured));
    }

    [HttpGet("oidc/challenge")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public IActionResult OidcChallenge()
    {
        if (!IsOidcConfigured(oidcOptions.Value))
        {
            return NotFound();
        }

        return Challenge(
            new AuthenticationProperties
            {
                RedirectUri = oidcOptions.Value.CallbackPath,
            },
            SsoAuthenticationSchemes.Oidc);
    }

    [HttpGet("saml/challenge")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> SamlChallenge(CancellationToken cancellationToken)
    {
        if (!samlOptions.Value.IsConfigured)
        {
            return NotFound();
        }

        var configuration = await HttpContext.RequestServices
            .GetRequiredService<SamlConfigurationProvider>()
            .GetAsync(cancellationToken);
        if (configuration is null)
        {
            return NotFound();
        }

        var authnRequest = new Saml2AuthnRequest(configuration)
        {
            AssertionConsumerServiceUrl = AbsoluteUri(samlOptions.Value.CallbackPath),
            ProtocolBinding = ProtocolBindings.HttpPost,
            NameIdPolicy = new NameIdPolicy { AllowCreate = true },
        };
        var binding = new Saml2RedirectBinding
        {
            RelayState = RelayStateProtector().Protect(authnRequest.IdAsString),
        };

        return binding.Bind(authnRequest).ToActionResult();
    }

    [HttpPost("saml/acs")]
    [AllowAnonymous]
    public async Task<IActionResult> SamlAssertionConsumerService(
        CancellationToken cancellationToken)
    {
        if (!samlOptions.Value.IsConfigured)
        {
            return NotFound();
        }

        try
        {
            var configuration = await HttpContext.RequestServices
                .GetRequiredService<SamlConfigurationProvider>()
                .GetAsync(cancellationToken);
            if (configuration is null)
            {
                return NotFound();
            }

            var httpRequest = Request.ToGenericHttpRequest(validate: true);
            var samlResponse = new Saml2AuthnResponse(configuration);
            httpRequest.Binding.ReadSamlResponse(httpRequest, samlResponse);
            if (samlResponse.Status != Saml2StatusCodes.Success)
            {
                return Unauthorized();
            }

            httpRequest.Binding.Unbind(httpRequest, samlResponse);
            var expectedRequestId = RelayStateProtector().Unprotect(
                httpRequest.Binding.RelayState ?? string.Empty);
            if (!string.Equals(
                    expectedRequestId,
                    samlResponse.InResponseToAsString,
                    StringComparison.Ordinal))
            {
                return Unauthorized();
            }

            var externalId = samlResponse.NameId?.Value;
            var email = FindClaim(
                samlResponse.ClaimsIdentity,
                samlOptions.Value.EmailAttributeName);
            if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(email))
            {
                return Unauthorized();
            }

            var displayName = FindClaim(
                    samlResponse.ClaimsIdentity,
                    ClaimTypes.Name,
                    "name",
                    "displayName")
                ?? email;
            var services = HttpContext.RequestServices;
            var user = await services
                .GetRequiredService<IJitProvisioningService>()
                .ProvisionOrLinkAsync(
                    eDMS.Domain.AuthProvider.Saml,
                    externalId,
                    email,
                    displayName,
                    cancellationToken);
            if (user is null)
            {
                return Unauthorized();
            }

            var code = await services
                .GetRequiredService<ISsoHandoffCodeStore>()
                .IssueAsync(user.Id, cancellationToken);
            return RedirectToSsoComplete(code: code);
        }
        catch (Exception exception)
        {
            HttpContext.RequestServices
                .GetRequiredService<ILogger<SsoController>>()
                .LogWarning(exception, "Rejected SAML assertion.");
            return Unauthorized();
        }
    }

    [HttpGet("saml/metadata")]
    [AllowAnonymous]
    public async Task<IActionResult> SamlMetadata(CancellationToken cancellationToken)
    {
        if (!samlOptions.Value.IsConfigured)
        {
            return NotFound();
        }

        var configuration = await HttpContext.RequestServices
            .GetRequiredService<SamlConfigurationProvider>()
            .GetAsync(cancellationToken);
        if (configuration is null)
        {
            return NotFound();
        }

        var entityDescriptor = new EntityDescriptor(configuration)
        {
            ValidUntil = 365,
            SPSsoDescriptor = new SPSsoDescriptor
            {
                AuthnRequestsSigned = configuration.SignAuthnRequest,
                WantAssertionsSigned = true,
                SigningCertificates = configuration.SigningCertificate is null
                    ? Array.Empty<X509Certificate2>()
                    : [configuration.SigningCertificate],
                AssertionConsumerServices =
                [
                    new AssertionConsumerService
                    {
                        Binding = ProtocolBindings.HttpPost,
                        Location = AbsoluteUri(samlOptions.Value.CallbackPath),
                        IsDefault = true,
                    },
                ],
            },
        };

        return new Saml2Metadata(entityDescriptor).CreateMetadata().ToActionResult();
    }

    internal static async Task HandleOidcTokenValidatedAsync(
        TokenValidatedContext context,
        ClientOptions clientOptions)
    {
        var principal = context.Principal;
        var externalId = FindClaim(principal, "sub", ClaimTypes.NameIdentifier);
        var email = FindClaim(principal, "email", ClaimTypes.Email);
        var displayName = FindClaim(principal, "name", ClaimTypes.Name)
            ?? email
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(email))
        {
            context.Fail("The identity provider did not return the required subject and email claims.");
            return;
        }

        var services = context.HttpContext.RequestServices;
        var jitProvisioning = services.GetRequiredService<IJitProvisioningService>();
        var user = await jitProvisioning.ProvisionOrLinkAsync(
            eDMS.Domain.AuthProvider.Oidc,
            externalId,
            email,
            displayName,
            context.HttpContext.RequestAborted);

        if (user is null)
        {
            context.Fail("The eDMS account is inactive or could not be provisioned.");
            return;
        }

        var handoffCodes = services.GetRequiredService<ISsoHandoffCodeStore>();
        var code = await handoffCodes.IssueAsync(user.Id, context.HttpContext.RequestAborted);
        var redirect = $"{clientOptions.BaseUrl.TrimEnd('/')}/sso/complete"
            + $"?code={Uri.EscapeDataString(code)}";

        context.Response.Redirect(redirect);
        context.HandleResponse();
    }

    internal static void HandleOidcRemoteFailure(
        RemoteFailureContext context,
        ClientOptions clientOptions)
    {
        var redirect = $"{clientOptions.BaseUrl.TrimEnd('/')}/sso/complete?error=provider-error";
        context.Response.Redirect(redirect);
        context.HandleResponse();
    }

    private IActionResult RedirectToSsoComplete(string? code = null, string? error = null)
    {
        var clientOptions = HttpContext.RequestServices
            .GetRequiredService<IOptions<ClientOptions>>()
            .Value;
        var query = code is not null
            ? $"?code={Uri.EscapeDataString(code)}"
            : $"?error={Uri.EscapeDataString(error ?? "provider-error")}";
        return Redirect($"{clientOptions.BaseUrl.TrimEnd('/')}/sso/complete{query}");
    }

    private IDataProtector RelayStateProtector() =>
        HttpContext.RequestServices
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("eDMS.Saml.RelayState.v1");

    private Uri AbsoluteUri(string path) =>
        new($"{Request.Scheme}://{Request.Host}{path}");

    private static bool IsOidcConfigured(OidcOptions options) =>
        !string.IsNullOrWhiteSpace(options.Authority);

    private static string? FindClaim(ClaimsPrincipal? principal, params string[] claimTypes) =>
        claimTypes
            .Select(type => principal?.FindFirst(type)?.Value)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static string? FindClaim(ClaimsIdentity? identity, params string[] claimTypes) =>
        claimTypes
            .Select(type => identity?.FindFirst(type)?.Value)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
}
