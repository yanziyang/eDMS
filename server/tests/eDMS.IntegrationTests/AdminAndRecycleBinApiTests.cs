using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Admin;
using eDMS.Application.RecycleBin;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class AdminAndRecycleBinApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AdminAndRecycleBinApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task User_management_lifecycle()
    {
        using var client = await AdminAsync();

        var newEmail = TestSupport.UniqueEmail();
        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/users",
            new
            {
                email = newEmail,
                displayName = "New Person",
                tempPassword = "TempPass1!",
                isSystemAdmin = false,
            });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var userId = Guid.Parse((await createResponse.Content.ReadAsStringAsync()).Trim('"'));

        var duplicate = await client.PostAsJsonAsync(
            "/api/v1/users",
            new
            {
                email = newEmail,
                displayName = "Again",
                tempPassword = "TempPass1!",
                isSystemAdmin = false,
            });
        await TestSupport.AssertProblemAsync(duplicate, HttpStatusCode.Conflict);

        var listResponse = await client.GetAsync($"/api/v1/users?search={Uri.EscapeDataString(newEmail)}");
        var users = await listResponse.Content.ReadFromJsonAsync<List<UserDto>>();
        Assert.Contains(users!, user => user.Id == userId && user.DisplayName == "New Person");

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/v1/users/{userId}",
            new { displayName = "Renamed Person", isSystemAdmin = true });
        Assert.Equal(HttpStatusCode.NoContent, updateResponse.StatusCode);

        var deactivate = await client.PostAsync($"/api/v1/users/{userId}/deactivate", null);
        Assert.Equal(HttpStatusCode.NoContent, deactivate.StatusCode);

        var reactivate = await client.PostAsync($"/api/v1/users/{userId}/reactivate", null);
        Assert.Equal(HttpStatusCode.NoContent, reactivate.StatusCode);

        var updateUnknown = await client.PutAsJsonAsync(
            $"/api/v1/users/{Guid.NewGuid()}",
            new { displayName = "X", isSystemAdmin = false });
        await TestSupport.AssertProblemAsync(updateUnknown, HttpStatusCode.NotFound);

        var deactivateUnknown = await client.PostAsync($"/api/v1/users/{Guid.NewGuid()}/deactivate", null);
        await TestSupport.AssertProblemAsync(deactivateUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Admin_endpoints_require_system_admin()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/admin/settings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/admin/storage")).StatusCode);
    }

    [Fact]
    public async Task Admin_settings_storage_and_audit_log()
    {
        using var client = await AdminAsync();
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "some content here");

        var settings = await (await client.GetAsync("/api/v1/admin/settings"))
            .Content.ReadFromJsonAsync<AdminSettingsDto>();
        Assert.NotNull(settings);
        Assert.True(settings!.MaxUploadSizeBytes > 0);

        var storage = await (await client.GetAsync("/api/v1/admin/storage"))
            .Content.ReadFromJsonAsync<List<StorageReportDto>>();
        Assert.Contains(storage!, item => item.SiteId == siteId && item.UsedBytes > 0);

        var auditLog = await (await client.GetAsync($"/api/v1/sites/{siteId}/audit-log"))
            .Content.ReadFromJsonAsync<List<AuditLogDto>>();
        Assert.NotEmpty(auditLog!);
    }

    [Fact]
    public async Task Recycle_bin_list_restore_and_permanent_delete()
    {
        using var client = await AdminAsync();
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var documentId = await TestSupport.UploadAsync(client, libraryId, "bin-doc.txt", "data");
        var folderId = await TestSupport.CreateFolderAsync(client, libraryId, "Bin Folder");

        await client.DeleteAsync($"/api/v1/documents/{documentId}");
        await client.DeleteAsync($"/api/v1/folders/{folderId}");

        var binResponse = await client.GetAsync($"/api/v1/sites/{siteId}/recycle-bin");
        var items = await binResponse.Content.ReadFromJsonAsync<List<RecycleBinItemDto>>();
        Assert.Contains(items!, item => item.Id == documentId && item.Kind == "document");
        Assert.Contains(items!, item => item.Id == folderId && item.Kind == "folder");

        var restoreDocument = await client.PostAsync(
            $"/api/v1/recycle-bin/{documentId}/restore?objectType=Document", null);
        Assert.Equal(HttpStatusCode.NoContent, restoreDocument.StatusCode);

        var restoreFolder = await client.PostAsync(
            $"/api/v1/recycle-bin/{folderId}/restore?objectType=Folder", null);
        Assert.Equal(HttpStatusCode.NoContent, restoreFolder.StatusCode);

        var afterRestore = await (await client.GetAsync($"/api/v1/sites/{siteId}/recycle-bin"))
            .Content.ReadFromJsonAsync<List<RecycleBinItemDto>>();
        Assert.Empty(afterRestore!);

        await client.DeleteAsync($"/api/v1/documents/{documentId}");
        var permanentDocument = await client.DeleteAsync(
            $"/api/v1/recycle-bin/{documentId}?objectType=Document");
        Assert.Equal(HttpStatusCode.NoContent, permanentDocument.StatusCode);

        var restoreMissing = await client.PostAsync(
            $"/api/v1/recycle-bin/{Guid.NewGuid()}/restore?objectType=Document", null);
        await TestSupport.AssertProblemAsync(restoreMissing, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Recycle_bin_requires_site_access()
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

        var binResponse = await other.GetAsync($"/api/v1/sites/{siteId}/recycle-bin");
        await TestSupport.AssertProblemAsync(binResponse, HttpStatusCode.Forbidden);
    }
}
