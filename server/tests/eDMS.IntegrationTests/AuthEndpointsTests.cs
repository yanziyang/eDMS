using System.Net;
using System.Net.Http.Json;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class AuthEndpointsTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuthEndpointsTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Login_returns_token_and_sets_refresh_cookie()
    {
        var email = UniqueEmail();
        await SeedUserAsync(email, "Password1!");
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { email, password = "Password1!" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);
        Assert.False(string.IsNullOrWhiteSpace(body!.AccessToken));
        Assert.Equal(email, body.User.Email);
        Assert.True(body.ExpiresInSeconds > 0);

        Assert.Contains(
            response.Headers,
            header => header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase)
                && header.Value.Any(value => value.Contains("edms_refresh=")));
    }

    [Fact]
    public async Task Login_with_bad_credentials_returns_unauthorized()
    {
        var email = UniqueEmail();
        await SeedUserAsync(email, "Password1!");
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { email, password = "wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_without_cookie_returns_unauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/v1/auth/refresh", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task SeedUserAsync(string email, string password)
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = email,
            EmailConfirmed = true,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@edms.local";

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, LoginUserResponse User);

    private sealed record LoginUserResponse(
        Guid Id,
        string Email,
        string DisplayName,
        bool IsSystemAdmin);
}
