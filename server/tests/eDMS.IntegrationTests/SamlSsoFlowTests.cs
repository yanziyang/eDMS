using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using eDMS.Application.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using DotNet.Testcontainers.Containers;

namespace eDMS.IntegrationTests;

/// <summary>
/// Drives the SP-initiated SAML flow against the real signed SimpleSAMLphp IdP.
/// Docker-less developer machines skip this container-backed check; CI runs it
/// with Docker and treats an unavailable provider as a failure.
/// </summary>
public sealed class SamlSsoFlowTests : IAsyncLifetime
{
    private IContainer? container;
    private SamlTestProvider? provider;
    private SamlApiFactory? factory;
    private bool available;
    private Exception? startupException;

    public async Task InitializeAsync()
    {
        try
        {
            provider = SamlTestProvider.Create();
            container = provider.CreateBuilder().Build();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            await container.StartAsync(timeout.Token);

            var idpSsoUrl =
                $"https://localhost:{container.GetMappedPublicPort(443)}"
                + "/simplesaml/saml2/idp/SSOService.php";
            factory = new SamlApiFactory(
                idpSsoUrl,
                Path.Combine(provider.SharedDirectory, "server.crt"));
            available = true;
        }
        catch (Exception exception)
        {
            available = false;
            startupException = exception;
        }
    }

    public async Task DisposeAsync()
    {
        factory?.Dispose();
        if (container is not null)
        {
            await container.DisposeAsync();
        }

        provider?.Dispose();
    }

    [Fact]
    public async Task Sp_initiated_flow_provisions_user_and_rejects_tampering()
    {
        if (!available)
        {
            SkipOrFailOnCi();
            return;
        }

        using var apiClient = factory!.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        apiClient.BaseAddress = new Uri("http://localhost:5080");

        using var providerClient = new HttpClient(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseCookies = true,
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
        });

        var challenge = await apiClient.GetAsync("/api/v1/auth/sso/saml/challenge");
        Assert.True(
            IsRedirect(challenge.StatusCode),
            $"SAML challenge returned {(int)challenge.StatusCode}: "
            + await challenge.Content.ReadAsStringAsync());
        var challengeLocation = Assert.IsType<Uri>(challenge.Headers.Location);
        var challengeQuery = QueryHelpers.ParseQuery(challengeLocation.Query);
        Assert.False(string.IsNullOrWhiteSpace(challengeQuery["SAMLRequest"]));
        Assert.False(string.IsNullOrWhiteSpace(challengeQuery["RelayState"]));
        Assert.DoesNotContain("access_token", challengeLocation.Query, StringComparison.OrdinalIgnoreCase);

        using var loginPageResponse = await GetFollowingRedirectsAsync(
            providerClient,
            challengeLocation);
        Assert.Equal(HttpStatusCode.OK, loginPageResponse.StatusCode);
        var loginPageUri = loginPageResponse.RequestMessage?.RequestUri ?? challengeLocation;
        var loginForm = ParseForm(
            await loginPageResponse.Content.ReadAsStringAsync(),
            loginPageUri);
        loginForm.Values["username"] = SamlTestProvider.DemoLogin;
        loginForm.Values["password"] = SamlTestProvider.DemoPassword;

        using var providerLoginResponse = await providerClient.PostAsync(
            loginForm.Action,
            new FormUrlEncodedContent(loginForm.Values));
        using var callbackPageResponse = await FollowGetRedirectsAsync(
            providerClient,
            providerLoginResponse,
            loginForm.Action);
        var callbackPage = await callbackPageResponse.Content.ReadAsStringAsync();
        var callbackForm = ParseForm(callbackPage, loginForm.Action);
        Assert.True(
            callbackForm.Values.TryGetValue("SAMLResponse", out var samlResponse),
            $"Expected SAML callback form; status={(int)callbackPageResponse.StatusCode}, "
            + $"uri={callbackPageResponse.RequestMessage?.RequestUri}, "
            + $"body={DescribeHtml(callbackPage)}");
        Assert.True(callbackForm.Values.TryGetValue("RelayState", out var relayState));

        var tamperedResponse = await apiClient.PostAsync(
            "/api/v1/auth/sso/saml/acs",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["SAMLResponse"] = TamperBase64(samlResponse!),
                ["RelayState"] = relayState!,
            }));
        Assert.Equal(HttpStatusCode.Unauthorized, tamperedResponse.StatusCode);

        var unsignedResponse = await apiClient.PostAsync(
            "/api/v1/auth/sso/saml/acs",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["SAMLResponse"] = RemoveXmlSignatures(samlResponse!),
                ["RelayState"] = relayState!,
            }));
        Assert.Equal(HttpStatusCode.Unauthorized, unsignedResponse.StatusCode);

        var callback = await apiClient.PostAsync(
            "/api/v1/auth/sso/saml/acs",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["SAMLResponse"] = samlResponse!,
                ["RelayState"] = relayState!,
            }));
        Assert.True(IsRedirect(callback.StatusCode), await callback.Content.ReadAsStringAsync());
        var completeLocation = Assert.IsType<Uri>(callback.Headers.Location);
        Assert.Contains("/sso/complete", completeLocation.AbsolutePath, StringComparison.Ordinal);
        Assert.DoesNotContain("access_token", completeLocation.Query, StringComparison.OrdinalIgnoreCase);
        var code = Query(completeLocation, "code");
        Assert.False(string.IsNullOrWhiteSpace(code));

        var exchange = await apiClient.PostAsJsonAsync(
            "/api/v1/auth/sso/exchange",
            new { code });
        Assert.Equal(HttpStatusCode.OK, exchange.StatusCode);
        var auth = await exchange.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(auth);
        Assert.Equal(SamlTestProvider.DemoEmail, auth!.User.Email);
        Assert.Empty(auth.User.SiteMemberships);

        var replay = await apiClient.PostAsJsonAsync(
            "/api/v1/auth/sso/exchange",
            new { code });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    private void SkipOrFailOnCi()
    {
        if (string.Equals(
                Environment.GetEnvironmentVariable("CI"),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"The SAML Testcontainer could not start on CI: {startupException}",
                startupException);
        }
    }

    private static async Task<HttpResponseMessage> GetFollowingRedirectsAsync(
        HttpClient client,
        Uri location)
    {
        var response = await client.GetAsync(location);
        return await FollowGetRedirectsAsync(client, response, location);
    }

    private static async Task<HttpResponseMessage> FollowGetRedirectsAsync(
        HttpClient client,
        HttpResponseMessage response,
        Uri currentLocation)
    {
        for (var attempt = 0; attempt < 6 && IsRedirect(response.StatusCode); attempt++)
        {
            var location = response.Headers.Location
                ?? throw new InvalidOperationException("SAML IdP redirect had no Location header.");
            response.Dispose();
            currentLocation = new Uri(currentLocation, location);
            response = await client.GetAsync(currentLocation);
        }

        return response;
    }

    private static bool IsRedirect(HttpStatusCode statusCode) =>
        statusCode is HttpStatusCode.Moved
            or HttpStatusCode.Redirect
            or HttpStatusCode.SeeOther
            or HttpStatusCode.TemporaryRedirect
            or HttpStatusCode.PermanentRedirect;

    private static string? Query(Uri uri, string key)
    {
        var values = QueryHelpers.ParseQuery(uri.Query);
        return values.TryGetValue(key, out var value) ? value.ToString() : null;
    }

    private static LoginForm ParseForm(string html, Uri fallbackAction)
    {
        var formMatch = Regex.Match(
            html,
            "<form\\b(?<attributes>[^>]*)>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var action = fallbackAction;
        var values = new Dictionary<string, string>(StringComparer.Ordinal);

        if (formMatch.Success)
        {
            var actionValue = Attribute(formMatch.Groups["attributes"].Value, "action");
            if (!string.IsNullOrWhiteSpace(actionValue))
            {
                action = new Uri(fallbackAction, WebUtility.HtmlDecode(actionValue));
            }

            foreach (Match input in Regex.Matches(
                         html,
                         "<input\\b(?<attributes>[^>]*)>",
                         RegexOptions.IgnoreCase | RegexOptions.Singleline))
            {
                var attributes = input.Groups["attributes"].Value;
                var name = Attribute(attributes, "name");
                var value = Attribute(attributes, "value");
                if (!string.IsNullOrWhiteSpace(name) && value is not null)
                {
                    values[name] = WebUtility.HtmlDecode(value);
                }
            }
        }

        return new LoginForm(action, values);
    }

    private static string? Attribute(string attributes, string name)
    {
        var match = Regex.Match(
            attributes,
            $"\\b{name}\\s*=\\s*(?:\\\"(?<double>[^\\\"]*)\\\"|'(?<single>[^']*)')",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success
            ? match.Groups["double"].Success
                ? match.Groups["double"].Value
                : match.Groups["single"].Value
            : null;
    }

    private static string TamperBase64(string value)
    {
        var bytes = Convert.FromBase64String(value);
        bytes[^1] ^= 1;
        return Convert.ToBase64String(bytes);
    }

    private static string DescribeHtml(string html)
    {
        var text = Regex.Replace(
            html,
            "<script\\b[^>]*>.*?</script>|<style\\b[^>]*>.*?</style>|<[^>]+>",
            " ",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(
            WebUtility.HtmlDecode(text),
            "\\s+",
            " ").Trim();
        return text.Length <= 4000 ? text : "…" + text[^3999..];
    }

    private static string RemoveXmlSignatures(string value)
    {
        var xml = XDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(value)));
        XNamespace signatureNamespace = "http://www.w3.org/2000/09/xmldsig#";
        xml.Descendants(signatureNamespace + "Signature").Remove();
        return Convert.ToBase64String(
            Encoding.UTF8.GetBytes(xml.ToString(SaveOptions.DisableFormatting)));
    }

    private sealed record LoginForm(Uri Action, Dictionary<string, string> Values);

    private sealed class SamlApiFactory(string idpSsoUrl, string idpCertificatePath) : ApiFactory
    {
        protected override void ConfigureAdditionalAppConfiguration(IConfigurationBuilder config)
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Saml:IdpEntityId"] = SamlTestProvider.EntityId,
                ["Saml:IdpSingleSignOnUrl"] = idpSsoUrl,
                ["Saml:IdpSigningCertificate"] = idpCertificatePath,
                ["Saml:EntityId"] = SamlTestProvider.SpEntityId,
                ["Saml:CallbackPath"] = SamlTestProvider.CallbackPath,
                ["Saml:EmailAttributeName"] =
                    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                ["Client:BaseUrl"] = "http://localhost:5199",
            });
        }
    }
}
