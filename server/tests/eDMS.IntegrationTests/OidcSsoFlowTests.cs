using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using eDMS.Api.Auth;
using eDMS.Application.Auth;
using eDMS.Domain;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
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

        using var callback = await CompleteOidcLoginAsync(apiClient, providerClient);

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

    [Fact]
    public async Task Deactivated_user_cannot_reenter_through_real_oidc_callback()
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
        using var providerClient = CreateProviderClient();
        using (var callback = await CompleteOidcLoginAsync(apiClient, providerClient))
        {
            Assert.True(IsRedirect(callback.StatusCode), await callback.Content.ReadAsStringAsync());
            var location = Assert.IsType<Uri>(callback.Headers.Location);
            var code = Query(location, "code");
            Assert.False(string.IsNullOrWhiteSpace(code));

            var exchange = await apiClient.PostAsJsonAsync(
                "/api/v1/auth/sso/exchange",
                new { code });
            Assert.Equal(HttpStatusCode.OK, exchange.StatusCode);
        }

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(MockOidcProvider.DemoEmail);
            Assert.NotNull(user);
            user!.IsActive = false;
            var result = await userManager.UpdateAsync(user);
            Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(error => error.Description)));
        }

        using var retryApiClient = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        using var retryProviderClient = CreateProviderClient();
        using var rejectedCallback = await CompleteOidcLoginAsync(retryApiClient, retryProviderClient);

        Assert.True(IsRedirect(rejectedCallback.StatusCode),
            await rejectedCallback.Content.ReadAsStringAsync());
        var rejectedLocation = Assert.IsType<Uri>(rejectedCallback.Headers.Location);
        Assert.Contains("/sso/complete", rejectedLocation.AbsolutePath, StringComparison.Ordinal);
        Assert.Equal("provider-error", Query(rejectedLocation, "error"));
        Assert.Null(Query(rejectedLocation, "code"));
    }

    [Fact]
    public async Task Oidc_callback_rejects_a_token_with_an_invalid_signature()
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

        using var tamperedFactory = new OidcApiFactory(ProviderBaseAddress(), tamperIdToken: true);
        using var apiClient = tamperedFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        using var providerClient = CreateProviderClient();
        using var rejectedCallback = await CompleteOidcLoginAsync(apiClient, providerClient);

        Assert.True(IsRedirect(rejectedCallback.StatusCode),
            await rejectedCallback.Content.ReadAsStringAsync());
        var rejectedLocation = Assert.IsType<Uri>(rejectedCallback.Headers.Location);
        Assert.Contains("/sso/complete", rejectedLocation.AbsolutePath, StringComparison.Ordinal);
        Assert.Equal("provider-error", Query(rejectedLocation, "error"));
        Assert.Null(Query(rejectedLocation, "code"));
    }

    private string ProviderBaseAddress() =>
        $"http://{_provider!.Hostname}:{_provider.GetMappedPublicPort(8080)}/{MockOidcProvider.IssuerId}";

    private static bool IsRedirect(HttpStatusCode statusCode) =>
        statusCode is HttpStatusCode.Moved or HttpStatusCode.Redirect or HttpStatusCode.SeeOther
            or HttpStatusCode.TemporaryRedirect or HttpStatusCode.PermanentRedirect;

    private static HttpClient CreateProviderClient() => new(new HttpClientHandler
    {
        AllowAutoRedirect = false,
        UseCookies = true,
    });

    private static async Task<HttpResponseMessage> CompleteOidcLoginAsync(
        HttpClient apiClient,
        HttpClient providerClient)
    {
        using var challenge = await apiClient.GetAsync("/api/v1/auth/sso/oidc/challenge");
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var authorizationLocation = Assert.IsType<Uri>(challenge.Headers.Location);
        Assert.Equal(MockOidcProvider.ClientId, Query(authorizationLocation, "client_id"));
        Assert.DoesNotContain("access_token", authorizationLocation.Query, StringComparison.OrdinalIgnoreCase);

        using var loginPage = await providerClient.GetAsync(authorizationLocation);
        Assert.Equal(HttpStatusCode.OK, loginPage.StatusCode);
        var form = ParseLoginForm(
            await loginPage.Content.ReadAsStringAsync(),
            authorizationLocation);
        form.Values["username"] = MockOidcProvider.DemoLogin;
        if (form.Values.ContainsKey("subject"))
        {
            form.Values["subject"] = MockOidcProvider.DemoLogin;
        }
        if (form.Values.ContainsKey("password"))
        {
            form.Values["password"] = "demo-password";
        }

        using var providerLogin = await providerClient.PostAsync(
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

        if (IsRedirect(callback.StatusCode))
        {
            var callbackLocation = Assert.IsType<Uri>(callback.Headers.Location);
            Assert.DoesNotContain("access_token", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("id_token", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("refresh_token", callbackLocation.Query, StringComparison.OrdinalIgnoreCase);
        }

        return callback;
    }

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

    private sealed class OidcApiFactory(string authority, bool tamperIdToken = false) : ApiFactory
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

            if (tamperIdToken)
            {
                builder.ConfigureServices(services =>
                    services.PostConfigure<OpenIdConnectOptions>(
                        SsoAuthenticationSchemes.Oidc,
                        options => options.Backchannel = new HttpClient(
                            new TamperIdTokenHandler
                            {
                                InnerHandler = new HttpClientHandler(),
                            })));
            }
        }
    }

    private sealed class TamperIdTokenHandler : DelegatingHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var response = await base.SendAsync(request, cancellationToken);
            if (request.RequestUri?.AbsolutePath.Contains(
                    "/token",
                    StringComparison.OrdinalIgnoreCase) != true
                || !response.IsSuccessStatusCode)
            {
                return response;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body)
                ?? throw new InvalidOperationException("OIDC token response was not a JSON object.");
            if (!payload.TryGetValue("id_token", out var idTokenElement)
                || string.IsNullOrWhiteSpace(idTokenElement.GetString()))
            {
                throw new InvalidOperationException("OIDC token response did not contain an id_token.");
            }

            payload["id_token"] = JsonSerializer.SerializeToElement(
                TamperJwtSignature(idTokenElement.GetString()!));
            response.Content.Dispose();
            response.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");
            return response;
        }

        private static string TamperJwtSignature(string token)
        {
            var segments = token.Split('.');
            if (segments.Length != 3)
            {
                throw new InvalidOperationException("OIDC id_token was not a JWT.");
            }

            var signature = DecodeBase64Url(segments[2]);
            if (signature.Length == 0)
            {
                throw new InvalidOperationException("OIDC id_token had an empty signature.");
            }

            signature[^1] ^= 1;
            segments[2] = EncodeBase64Url(signature);
            return string.Join('.', segments);
        }

        private static byte[] DecodeBase64Url(string value)
        {
            var padded = value.Replace('-', '+').Replace('_', '/');
            padded += new string('=', (4 - padded.Length % 4) % 4);
            return Convert.FromBase64String(padded);
        }

        private static string EncodeBase64Url(byte[] value) => Convert
            .ToBase64String(value)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
