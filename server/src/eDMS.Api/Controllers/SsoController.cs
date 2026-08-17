using System.Security.Claims;
using eDMS.Api.Auth;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/auth/sso")]
public sealed class SsoController(
    IOptions<OidcOptions> oidcOptions) : ControllerBase
{
    [HttpGet("providers")]
    [AllowAnonymous]
    public IActionResult Providers()
    {
        return Ok(new SsoProvidersResponse(
            Oidc: IsOidcConfigured(oidcOptions.Value),
            Saml: false));
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
        if (string.Equals(
                context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().EnvironmentName,
                "Testing",
                StringComparison.Ordinal)
            && context.Failure is not null)
        {
            context.Response.Headers["X-EDMS-Test-Remote-Failure"] =
                $"{context.Failure.GetType().FullName}: {context.Failure.Message}";
        }

        var redirect = $"{clientOptions.BaseUrl.TrimEnd('/')}/sso/complete?error=provider-error";
        context.Response.Redirect(redirect);
        context.HandleResponse();
    }

    private static bool IsOidcConfigured(OidcOptions options) =>
        !string.IsNullOrWhiteSpace(options.Authority);

    private static string? FindClaim(ClaimsPrincipal? principal, params string[] claimTypes) =>
        claimTypes
            .Select(type => principal?.FindFirst(type)?.Value)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
}
