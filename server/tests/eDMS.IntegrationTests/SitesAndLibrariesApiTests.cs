using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Sites;
using eDMS.Application.Documents;

namespace eDMS.IntegrationTests;

public sealed class SitesAndLibrariesApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public SitesAndLibrariesApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Admin_can_create_get_list_update_and_delete_a_site()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var slug = TestSupport.UniqueSlug();
        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = "Engineering", description = "Eng docs", urlSlug = slug });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var siteId = Guid.Parse((await createResponse.Content.ReadAsStringAsync()).Trim('"'));

        var getResponse = await client.GetAsync($"/api/v1/sites/{siteId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var site = await getResponse.Content.ReadFromJsonAsync<SiteDto>();
        Assert.Equal("Engineering", site!.Name);
        Assert.Equal(slug, site.UrlSlug);
        Assert.Equal("Eng docs", site.Description);

        var listResponse = await client.GetAsync("/api/v1/sites");
        var sites = await listResponse.Content.ReadFromJsonAsync<List<SiteDto>>();
        Assert.Contains(sites!, item => item.Id == siteId);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/v1/sites/{siteId}",
            new { name = "Engineering 2", description = (string?)null, storageQuotaBytes = 1_000_000L });
        Assert.Equal(HttpStatusCode.NoContent, updateResponse.StatusCode);

        var updated = await (await client.GetAsync($"/api/v1/sites/{siteId}"))
            .Content.ReadFromJsonAsync<SiteDto>();
        Assert.Equal("Engineering 2", updated!.Name);
        Assert.Equal(1_000_000L, updated.StorageQuotaBytes);

        var deleteResponse = await client.DeleteAsync($"/api/v1/sites/{siteId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missing = await client.GetAsync($"/api/v1/sites/{siteId}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Create_site_rejects_duplicate_slug_and_invalid_inputs()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var slug = TestSupport.UniqueSlug();
        var first = await client.PostAsJsonAsync("/api/v1/sites", new { name = "A", urlSlug = slug });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var duplicate = await client.PostAsJsonAsync("/api/v1/sites", new { name = "B", urlSlug = slug });
        await TestSupport.AssertProblemAsync(duplicate, HttpStatusCode.Conflict);

        var invalidSlug = await client.PostAsJsonAsync("/api/v1/sites", new { name = "C", urlSlug = "Not Valid!" });
        await TestSupport.AssertProblemAsync(invalidSlug, HttpStatusCode.BadRequest);

        var emptyName = await client.PostAsJsonAsync("/api/v1/sites", new { name = "", urlSlug = "valid-slug" });
        await TestSupport.AssertProblemAsync(emptyName, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Non_admin_can_create_sites_by_default_but_cannot_manage_foreign_sites()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = "My Site", urlSlug = TestSupport.UniqueSlug() });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var ownSiteId = Guid.Parse((await createResponse.Content.ReadAsStringAsync()).Trim('"'));

        var listResponse = await client.GetAsync("/api/v1/sites");
        var sites = await listResponse.Content.ReadFromJsonAsync<List<SiteDto>>();
        Assert.Contains(sites!, site => site.Id == ownSiteId);

        // Managing a site the user has no access to is still forbidden.
        var foreignUpdate = await client.PutAsJsonAsync(
            $"/api/v1/sites/{Guid.NewGuid()}",
            new { name = "X", description = (string?)null, storageQuotaBytes = (long?)null });
        await TestSupport.AssertProblemAsync(foreignUpdate, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Update_site_validates_and_returns_404_for_unknown_site()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var unknown = await client.PutAsJsonAsync(
            $"/api/v1/sites/{Guid.NewGuid()}",
            new { name = "X", description = (string?)null, storageQuotaBytes = (long?)null });
        await TestSupport.AssertProblemAsync(unknown, HttpStatusCode.NotFound);

        var invalid = await client.PutAsJsonAsync(
            $"/api/v1/sites/{Guid.NewGuid()}",
            new { name = "", description = (string?)null, storageQuotaBytes = (long?)null });
        await TestSupport.AssertProblemAsync(invalid, HttpStatusCode.BadRequest);

        var deleteUnknown = await client.DeleteAsync($"/api/v1/sites/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(deleteUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Owner_can_create_and_list_libraries()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var (siteId, _) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var createResponse = await client.PostAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries",
            new
            {
                name = "Finance",
                description = "Numbers",
                enableVersioning = true,
                enableMinorVersions = true,
                requireCheckout = false,
            });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var librariesResponse = await client.GetAsync($"/api/v1/sites/{siteId}/libraries");
        var libraries = await librariesResponse.Content.ReadFromJsonAsync<List<LibraryDto>>();
        Assert.Contains(libraries!, library => library.Name == "Finance");
    }

    [Fact]
    public async Task Non_owner_cannot_create_library_in_foreign_site()
    {
        var adminEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, adminEmail, "Password1!", isAdmin: true);
        var (adminToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), adminEmail, "Password1!");
        using var admin = TestSupport.AuthorizedClient(_factory, adminToken);
        var (siteId, _) = await TestSupport.CreateSiteWithLibraryAsync(admin);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);

        var createResponse = await other.PostAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries",
            new
            {
                name = "Intruder",
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = false,
                requireCheckout = false,
            });
        await TestSupport.AssertProblemAsync(createResponse, HttpStatusCode.Forbidden);
    }
}
