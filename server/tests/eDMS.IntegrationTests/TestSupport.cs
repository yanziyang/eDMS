using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.IntegrationTests;

internal static class TestSupport
{
    public static string UniqueEmail() => $"{Guid.NewGuid():N}@edms.test";

    public static string UniqueSlug() => $"site-{Guid.NewGuid():N}"[..29];

    public static async Task<ApplicationUser> SeedUserAsync(
        ApiFactory factory,
        string email,
        string password,
        bool isAdmin = false,
        bool isActive = true)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = email,
            EmailConfirmed = true,
            IsActive = isActive,
            IsSystemAdmin = isAdmin,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(error => error.Description)));
        return user;
    }

    public static async Task<(string Token, string? RefreshToken)> LoginAsync(
        HttpClient client,
        string email,
        string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>()
            ?? throw new InvalidOperationException("Login returned no body.");

        var cookie = response.Headers
            .FirstOrDefault(header => header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
            .Value
            .FirstOrDefault(value => value.StartsWith("edms_refresh=", StringComparison.Ordinal));
        var refreshToken = cookie is null ? null : cookie.Split(';')[0]["edms_refresh=".Length..];

        return (body.AccessToken, refreshToken);
    }

    public static HttpClient AuthorizedClient(ApiFactory factory, string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public static async Task<(Guid SiteId, Guid LibraryId)> CreateSiteWithLibraryAsync(
        HttpClient adminClient,
        string? slug = null)
    {
        slug ??= UniqueSlug();
        var siteResponse = await adminClient.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = $"Site {slug}", description = (string?)null, urlSlug = slug });
        siteResponse.EnsureSuccessStatusCode();
        var siteId = Guid.Parse((await siteResponse.Content.ReadAsStringAsync()).Trim('"'));

        var librariesResponse = await adminClient.GetAsync($"/api/v1/sites/{siteId}/libraries");
        librariesResponse.EnsureSuccessStatusCode();
        var libraries = await librariesResponse.Content
            .ReadFromJsonAsync<List<eDMS.Application.Documents.LibraryDto>>() ?? [];
        Assert.NotEmpty(libraries);

        return (siteId, libraries[0].Id);
    }

    public static async Task<Guid> CreateFolderAsync(HttpClient client, Guid libraryId, string name)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/libraries/{libraryId}/folders",
            new { name });
        response.EnsureSuccessStatusCode();
        return Guid.Parse((await response.Content.ReadAsStringAsync()).Trim('"'));
    }

    public static async Task<Guid> CreateChildFolderAsync(
        HttpClient client,
        Guid libraryId,
        Guid parentFolderId,
        string name)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/folders/{parentFolderId}/folders",
            new { name, libraryId });
        response.EnsureSuccessStatusCode();
        return Guid.Parse((await response.Content.ReadAsStringAsync()).Trim('"'));
    }

    public static async Task<Guid> UploadAsync(
        HttpClient client,
        Guid libraryId,
        string fileName,
        string content)
    {
        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(content));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        multipart.Add(fileContent, "file", fileName);

        var response = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", multipart);
        response.EnsureSuccessStatusCode();
        var result = await response.Content
            .ReadFromJsonAsync<eDMS.Application.Documents.UploadResult>()
            ?? throw new InvalidOperationException("Upload returned no body.");
        return result.DocumentId;
    }

    public static async Task<Guid> UploadToFolderAsync(
        HttpClient client,
        Guid folderId,
        string fileName,
        string content)
    {
        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(content));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        multipart.Add(fileContent, "file", fileName);

        var response = await client.PostAsync($"/api/v1/folders/{folderId}/documents", multipart);
        response.EnsureSuccessStatusCode();
        var result = await response.Content
            .ReadFromJsonAsync<eDMS.Application.Documents.UploadResult>()
            ?? throw new InvalidOperationException("Folder upload returned no body.");
        return result.DocumentId;
    }

    public static async Task AssertProblemAsync(
        HttpResponseMessage response,
        System.Net.HttpStatusCode expectedStatus)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.NotNull(problem.RootElement.GetProperty("title").GetString());
    }

    public static TestAppSettings DefaultAppSettings() => new();
}

internal sealed class TestAppSettings : IAppSettings
{
    public long MaxUploadSizeBytes { get; set; } = 262_144_000;

    public int RecycleBinRetentionDays { get; set; } = 90;

    public bool SiteCreationRestricted { get; set; }

    public bool SsoEnforcedGlobally { get; set; }

    public Task<long> GetMaxUploadSizeBytesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(MaxUploadSizeBytes);

    public Task<int> GetRecycleBinRetentionDaysAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(RecycleBinRetentionDays);

    public Task<bool> GetSiteCreationRestrictedAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(SiteCreationRestricted);

    public Task<bool> GetSsoEnforcedGloballyAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(SsoEnforcedGlobally);

    public Task UpsertAsync(IReadOnlyCollection<(string Key, string Value)> updates, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
