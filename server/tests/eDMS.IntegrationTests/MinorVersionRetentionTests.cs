using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Documents;

namespace eDMS.IntegrationTests;

public sealed class MinorVersionRetentionTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public MinorVersionRetentionTests(ApiFactory factory) => _factory = factory;

    private async Task<(HttpClient Client, Guid SiteId, Guid LibraryId)> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        var client = TestSupport.AuthorizedClient(_factory, token);
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        return (client, siteId, libraryId);
    }

    private static async Task<Guid> CreateLibraryAsync(HttpClient client, Guid siteId, string name, int? cap)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries",
            new
            {
                name,
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = true,
                requireCheckout = false,
                minorVersionsRetained = cap,
            });
        response.EnsureSuccessStatusCode();
        return Guid.Parse((await response.Content.ReadAsStringAsync()).Trim('"'));
    }

    [Fact]
    public async Task Checked_out_upload_creates_minor_version_when_enabled()
    {
        var (client, siteId, _) = await AdminAsync();
        var libraryId = await CreateLibraryAsync(client, siteId, "Minor", cap: null);
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1.1");
        await client.PostAsJsonAsync($"/api/v1/documents/{documentId}/checkin", new { comment = "wip" });

        var versions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal(2, versions!.Count);
        Assert.Contains(versions, version => version.VersionMajor == 1 && version.VersionMinor == 1 && !version.IsMajor);

        // A normal (non-checked-out) upload still creates a major version.
        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");
        var after = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Contains(after!, version => version.VersionMajor == 2 && version.IsMajor);
    }

    [Fact]
    public async Task Minor_version_cap_trims_oldest_minors_but_keeps_majors()
    {
        var (client, siteId, _) = await AdminAsync();
        var libraryId = await CreateLibraryAsync(client, siteId, "Capped", cap: 2);

        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");

        // Produce 3 minors under major 2.
        for (var i = 0; i < 3; i++)
        {
            await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
            await TestSupport.UploadAsync(client, libraryId, "doc.txt", $"v2.{i + 1}");
            await client.PostAsJsonAsync($"/api/v1/documents/{documentId}/checkin", new { comment = "wip" });
        }

        var versions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();

        // v1.0 major + v2.0 major + 2 newest minors (cap 2) = 4 versions.
        Assert.Equal(4, versions!.Count);
        Assert.DoesNotContain(versions, version => version.VersionMajor == 2 && version.VersionMinor == 1);
        Assert.Contains(versions, version => version.VersionMajor == 2 && version.VersionMinor == 3);
        Assert.Contains(versions, version => version.VersionMajor == 2 && version.VersionMinor == 2);
        Assert.Contains(versions, version => version.VersionMajor == 1 && version.VersionMinor == 0);
        Assert.Contains(versions, version => version.VersionMajor == 2 && version.VersionMinor == 0 && version.IsMajor);
    }

    [Fact]
    public async Task Library_settings_update_roundtrip()
    {
        var (client, siteId, libraryId) = await AdminAsync();

        var update = await client.PutAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries/{libraryId}",
            new
            {
                name = "Renamed",
                description = "New desc",
                enableVersioning = true,
                enableMinorVersions = true,
                requireCheckout = true,
                minorVersionsRetained = 5,
            });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var libraries = await (await client.GetAsync($"/api/v1/sites/{siteId}/libraries"))
            .Content.ReadFromJsonAsync<List<LibraryDto>>();
        var library = libraries!.Single(item => item.Id == libraryId);
        Assert.Equal("Renamed", library.Name);
        Assert.True(library.RequireCheckout);
        Assert.Equal(5, library.MinorVersionsRetained);

        var updateUnknown = await client.PutAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries/{Guid.NewGuid()}",
            new
            {
                name = "X",
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = false,
                requireCheckout = false,
                minorVersionsRetained = (int?)null,
            });
        await TestSupport.AssertProblemAsync(updateUnknown, HttpStatusCode.NotFound);

        var invalidCap = await client.PutAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries/{libraryId}",
            new
            {
                name = "Renamed",
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = true,
                requireCheckout = false,
                minorVersionsRetained = 0,
            });
        await TestSupport.AssertProblemAsync(invalidCap, HttpStatusCode.BadRequest);
    }
}
