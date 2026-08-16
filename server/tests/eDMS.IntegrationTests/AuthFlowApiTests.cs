using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Auth;

namespace eDMS.IntegrationTests;

public sealed class AuthFlowApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuthFlowApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Inactive_user_cannot_login_or_use_me()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isActive: false);
        var client = _factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Password1!" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task Me_returns_current_user()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var me = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var user = await me.Content.ReadFromJsonAsync<CurrentUserDto>();
        Assert.Equal(email, user!.Email);
        Assert.True(user.IsSystemAdmin);
    }

    [Fact]
    public async Task Refresh_rotates_then_reuse_is_rejected()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var raw = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = false,
        });
        var (_, refreshToken) = await TestSupport.LoginAsync(raw, email, "Password1!");
        Assert.NotNull(refreshToken);

        using var firstRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        firstRequest.Headers.Add("Cookie", $"edms_refresh={refreshToken}");
        var firstRefresh = await raw.SendAsync(firstRequest);
        Assert.Equal(HttpStatusCode.OK, firstRefresh.StatusCode);
        var firstBody = await firstRefresh.Content.ReadFromJsonAsync<RefreshResponse>();
        Assert.False(string.IsNullOrWhiteSpace(firstBody!.AccessToken));

        using var reuseRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        reuseRequest.Headers.Add("Cookie", $"edms_refresh={refreshToken}");
        var reuse = await raw.SendAsync(reuseRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
    }

    [Fact]
    public async Task Logout_clears_cookie()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var raw = _factory.CreateClient();
        var (token, _) = await TestSupport.LoginAsync(raw, email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var logout = await client.PostAsync("/api/v1/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Contains(
            logout.Headers,
            header => header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase)
                && header.Value.Any(value => value.Contains("edms_refresh=")));
    }

    [Fact]
    public async Task Forgot_password_returns_ok_and_reset_with_bad_token_fails()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var client = _factory.CreateClient();

        var forgot = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email });
        Assert.Equal(HttpStatusCode.OK, forgot.StatusCode);

        var forgotUnknown = await client.PostAsJsonAsync(
            "/api/v1/auth/forgot-password",
            new { email = "nobody@edms.test" });
        Assert.Equal(HttpStatusCode.OK, forgotUnknown.StatusCode);

        var reset = await client.PostAsJsonAsync(
            "/api/v1/auth/reset-password",
            new { email, token = "bogus", newPassword = "NewPassword1!" });
        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode);
    }
}
