using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using eDMS.Application.Sites;

namespace eDMS.IntegrationTests;

public sealed class StorageQuotaApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public StorageQuotaApiTests(ApiFactory factory) => _factory = factory;

    private async Task<(HttpClient Client, Guid SiteId, Guid LibraryId)> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        var client = TestSupport.AuthorizedClient(_factory, token);
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        return (client, siteId, libraryId);
    }

    [Fact]
    public async Task Upload_at_quota_is_allowed_but_one_byte_over_is_rejected_and_metadata_edits_are_allowed()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var seedId = await TestSupport.UploadAsync(client, libraryId, "seed.txt", "123456789");
        var site = await GetSiteAsync(client, siteId);
        await SetQuotaAsync(client, site, 10);

        var exactId = await TestSupport.UploadAsync(client, libraryId, "exact.txt", "x");
        var rejected = await UploadAsync(client, libraryId, "over.txt", "x");
        await AssertQuotaProblemAsync(rejected, site.Name, 10);

        var renamed = await client.PutAsJsonAsync(
            $"/api/v1/documents/{exactId}",
            new { name = "renamed.txt", title = (string?)null, description = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, renamed.StatusCode);

        var metadata = await client.PutAsJsonAsync(
            $"/api/v1/documents/{exactId}",
            new { name = (string?)null, title = "No bytes added", description = "Still within the same Site." });
        Assert.Equal(HttpStatusCode.NoContent, metadata.StatusCode);
        Assert.NotEqual(Guid.Empty, seedId);
    }

    [Fact]
    public async Task Checkin_fails_closed_when_the_Site_is_already_over_quota()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var documentId = await TestSupport.UploadAsync(client, libraryId, "checked-out.txt", "four");
        var site = await GetSiteAsync(client, siteId);
        await SetQuotaAsync(client, site, 1);

        var checkout = await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        Assert.Equal(HttpStatusCode.NoContent, checkout.StatusCode);

        var checkin = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/checkin",
            new { comment = "quota check" });
        await AssertQuotaProblemAsync(checkin, site.Name, 1);
    }

    [Fact]
    public async Task Cross_site_copy_and_move_are_rejected_when_the_destination_quota_would_be_exceeded()
    {
        var (client, _, sourceLibraryId) = await AdminAsync();
        var (destinationSiteId, destinationLibraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        var documentId = await TestSupport.UploadAsync(client, sourceLibraryId, "cross-site.txt", "four");
        var destinationSite = await GetSiteAsync(client, destinationSiteId);
        await SetQuotaAsync(client, destinationSite, 3);

        var copy = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId, destinationFolderId = (Guid?)null });
        await AssertQuotaProblemAsync(copy, destinationSite.Name, 3);

        var move = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId, destinationFolderId = (Guid?)null });
        await AssertQuotaProblemAsync(move, destinationSite.Name, 3);
    }

    private static async Task<SiteDto> GetSiteAsync(HttpClient client, Guid siteId) =>
        await (await client.GetAsync($"/api/v1/sites/{siteId}"))
            .Content.ReadFromJsonAsync<SiteDto>()
        ?? throw new InvalidOperationException("Site response was empty.");

    private static async Task SetQuotaAsync(HttpClient client, SiteDto site, long quotaBytes)
    {
        var response = await client.PutAsJsonAsync(
            $"/api/v1/sites/{site.Id}",
            new { name = site.Name, description = site.Description, storageQuotaBytes = quotaBytes });
        response.EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> UploadAsync(
        HttpClient client,
        Guid libraryId,
        string fileName,
        string content)
    {
        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(content));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        multipart.Add(fileContent, "file", fileName);
        return await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", multipart);
    }

    private static async Task AssertQuotaProblemAsync(
        HttpResponseMessage response,
        string siteName,
        long quotaBytes)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("urn:edms:quota-exceeded", problem.RootElement.GetProperty("type").GetString());
        Assert.Equal("quota-exceeded", problem.RootElement.GetProperty("rejectionReason").GetString());
        Assert.Equal(siteName, problem.RootElement.GetProperty("siteName").GetString());
        Assert.Equal(quotaBytes, problem.RootElement.GetProperty("quotaBytes").GetInt64());
    }
}
