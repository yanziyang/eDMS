using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using eDMS.Application.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using DotNet.Testcontainers.Containers;

namespace eDMS.IntegrationTests;

/// <summary>
/// Exercises the real browser-shaped Authorization Code Flow against the signed
/// mock provider. Machines without Docker skip this container-backed check; CI's
/// Docker-enabled runner executes it end to end.
/// </summary>
public sealed class OidcSsoFlowTests : IAsyncLifetime
{
    private IContainer? _provider;
    private OidcApiFactory? _factory;
    private bool _available;
    private Exception? _startupException;

    public async Task InitializeAsync()
    {
        try
        {
            _provider = MockOidcProvider.CreateBuilder().Build();
            await _provider.StartAsync();
            var authority = ProviderBaseAddress();
            _factory = new OidcApiFactory(authority);
            _available = true;
        }
        catch (Exception exception)
        {
            _available = false;
            _startupException = exception;
        }
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_provider is not null)
        {
            await _provider.DisposeAsync();
        }
    }

    [Fact]
    public async Task Authorization_code_flow_returns_a_real_eDMS_access_token()
    {
        if (!_available)
        {
            if (string.Equals(Environment.GetEnvironmentVariable("CI"), "true", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"The OIDC Testcontainer could not start on CI: {_startupException}",
                    _startupException);
            }
            return;
        }

        using var apiClient = _factory!.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        using var providerClient = new HttpClient(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseCookies = true,
        });

        var challenge = await apiClient.GetAsync("/api/v1/auth/sso/oidc/challenge");
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var authorizationLocation = Assert.IsType<Uri>(challenge.Headers.Location);
        Assert.Equal(MockOidcProvider.ClientId, Query(authorizationLocation, "client_id"));
        Assert.DoesNotContain("access_token", authorizationLocation.Query, StringComparison.OrdinalIgnoreCase);

        var loginPage = await providerClient.GetAsync(authorizationLocation);
        Assert.Equal(HttpStatusCode.OK, loginPage.StatusCode);
        var loginHtml = await loginPage.Content.ReadAsStringAsync();
        var form = ParseLoginForm(loginHtml, authorizationLocation);
        form.Values["username"] = MockOidcProvider.DemoLogin;
        if (form.Values.ContainsKey("subject"))
        {
            form.Values["subject"] = MockOidcProvider.DemoLogin;
        }
        if (form.Values.ContainsKey("password"))
        {
            form.Values["password"] = "demo-password";
        }

        var providerLogin = await providerClient.PostAsync(
            form.Action,
            new FormUrlEncodedContent(form.Values));
        HttpResponseMessage callback;
        if (IsRedirect(providerLogin.StatusCode))
        {
            var callbackLocation = Assert.IsType<Uri>(providerLogin.Headers.Location);
            Assert.Contains("code=", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("access_token", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("id_token", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
            callback = await apiClient.GetAsync(callbackLocation);
        }
        else
        {
            Assert.Equal(HttpStatusCode.OK, providerLogin.StatusCode);
            var callbackForm = ParseLoginForm(
                await providerLogin.Content.ReadAsStringAsync(),
                authorizationLocation);
            Assert.True(callbackForm.Values.ContainsKey("code"));
            Assert.True(callbackForm.Values.ContainsKey("state"));
            callback = await apiClient.PostAsync(
                callbackForm.Action,
                new FormUrlEncodedContent(callbackForm.Values));
        }

        Assert.True(IsRedirect(callback.StatusCode), await callback.Content.ReadAsStringAsync());
        var completeLocation = Assert.IsType<Uri>(callback.Headers.Location);
        Assert.Equal("http", completeLocation.Scheme);
        Assert.Contains("/sso/complete", completeLocation.AbsolutePath);
        Assert.DoesNotContain("access_token", completeLocation.Query, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("id_token", completeLocation.Query, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("refresh_token", completeLocation.Query, StringComparison.OrdinalIgnoreCase);

        var code = Query(completeLocation, "code");
        Assert.False(string.IsNullOrWhiteSpace(code),
            $"OIDC callback did not issue a handoff code: {completeLocation}");

        var exchange = await apiClient.PostAsJsonAsync(
            "/api/v1/auth/sso/exchange",
            new { code });
        Assert.Equal(HttpStatusCode.OK, exchange.StatusCode);
        var auth = await exchange.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth!.AccessToken));
        Assert.Equal(MockOidcProvider.DemoEmail, auth.User.Email);
        Assert.Empty(auth.User.SiteMemberships);

        using var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var me = await apiClient.SendAsync(meRequest);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);

        var replay = await apiClient.PostAsJsonAsync(
            "/api/v1/auth/sso/exchange",
            new { code });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    private string ProviderBaseAddress() =>
        $"http://{_provider!.Hostname}:{_provider.GetMappedPublicPort(8080)}/{MockOidcProvider.IssuerId}";

    private static bool IsRedirect(HttpStatusCode statusCode) =>
        statusCode is HttpStatusCode.Moved or HttpStatusCode.Redirect or HttpStatusCode.SeeOther
            or HttpStatusCode.TemporaryRedirect or HttpStatusCode.PermanentRedirect;

    private static string? Query(Uri uri, string key)
    {
        var values = QueryHelpers.ParseQuery(uri.Query);
        return values.TryGetValue(key, out var value) ? value.ToString() : null;
    }

    private static LoginForm ParseLoginForm(string html, Uri fallbackAction)
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

            var inputMatches = Regex.Matches(
                html,
                "<input\\b(?<attributes>[^>]*)>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
            foreach (Match input in inputMatches)
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

    private sealed record LoginForm(Uri Action, Dictionary<string, string> Values);

    private sealed class OidcApiFactory(string authority) : ApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder
                .UseSetting("Oidc:Authority", authority)
                .UseSetting("Oidc:ClientId", MockOidcProvider.ClientId)
                .UseSetting("Oidc:ClientSecret", MockOidcProvider.ClientSecret)
                .UseSetting("Oidc:CallbackPath", MockOidcProvider.CallbackPath)
                .UseSetting("Oidc:RequireHttpsMetadata", "false")
                .UseSetting("Client:BaseUrl", "http://localhost:5199");
        }
    }
}
