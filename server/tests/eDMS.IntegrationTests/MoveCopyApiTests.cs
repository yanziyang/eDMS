using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Admin;
using eDMS.Application.Documents;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class MoveCopyApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public MoveCopyApiTests(ApiFactory factory) => _factory = factory;

    private async Task<(HttpClient Client, Guid SiteId, Guid LibraryId)> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        var client = TestSupport.AuthorizedClient(_factory, token);
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        return (client, siteId, libraryId);
    }

    private static async Task<Guid> CreateLibraryAsync(HttpClient client, Guid siteId, string name)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries",
            new
            {
                name,
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = false,
                requireCheckout = false,
            });
        response.EnsureSuccessStatusCode();
        return Guid.Parse((await response.Content.ReadAsStringAsync()).Trim('"'));
    }

    [Fact]
    public async Task Move_relocates_document_and_keeps_version_history()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var archiveId = await CreateLibraryAsync(client, siteId, "Archive");

        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");

        var moveResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        Assert.Equal(documentId, Guid.Parse((await moveResponse.Content.ReadAsStringAsync()).Trim('"')));

        var sourceItems = await (await client.GetAsync($"/api/v1/libraries/{libraryId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.DoesNotContain(sourceItems!, item => item.Kind == "document");

        var destinationItems = await (await client.GetAsync($"/api/v1/libraries/{archiveId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(destinationItems!, item => item.Kind == "document" && item.Name == "doc.txt");

        var versions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal(2, versions!.Count);
    }

    [Fact]
    public async Task Move_into_folder_lands_in_that_folder()
    {
        var (client, _, libraryId) = await AdminAsync();
        var folderId = await TestSupport.CreateFolderAsync(client, libraryId, "Dest");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        var moveResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = libraryId, destinationFolderId = folderId });
        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);

        var folderItems = await (await client.GetAsync($"/api/v1/folders/{folderId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(folderItems!, item => item.Kind == "document" && item.Id == documentId);
    }

    [Fact]
    public async Task Copy_creates_fresh_v1_document_with_same_content()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var archiveId = await CreateLibraryAsync(client, siteId, "Archive");

        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");

        var copyResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, copyResponse.StatusCode);
        var copyId = Guid.Parse((await copyResponse.Content.ReadAsStringAsync()).Trim('"'));

        Assert.NotEqual(documentId, copyId);

        var download = await client.GetAsync($"/api/v1/documents/{copyId}/download");
        Assert.Equal("v2", await download.Content.ReadAsStringAsync());

        var versions = await (await client.GetAsync($"/api/v1/documents/{copyId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        var version = Assert.Single(versions!);
        Assert.Equal(1, version.VersionMajor);

        // Source untouched: still two versions.
        var sourceVersions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal(2, sourceVersions!.Count);
    }

    [Fact]
    public async Task Copy_name_conflict_in_destination_is_rejected()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var archiveId = await CreateLibraryAsync(client, siteId, "Archive");

        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        await TestSupport.UploadAsync(client, archiveId, "doc.txt", "other");

        var copyResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(copyResponse, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Move_across_sites_is_rejected()
    {
        var (client, _, libraryId) = await AdminAsync();
        var (_, otherLibraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        var moveResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = otherLibraryId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(moveResponse, HttpStatusCode.Conflict);

        var copyResponse = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId = otherLibraryId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(copyResponse, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Move_copy_error_paths()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var archiveId = await CreateLibraryAsync(client, siteId, "Archive");
        var foreignFolderId = await TestSupport.CreateFolderAsync(client, archiveId, "Foreign");

        var unknown = await client.PostAsJsonAsync(
            $"/api/v1/documents/{Guid.NewGuid()}/move",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(unknown, HttpStatusCode.NotFound);

        var unknownCopy = await client.PostAsJsonAsync(
            $"/api/v1/documents/{Guid.NewGuid()}/copy",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(unknownCopy, HttpStatusCode.NotFound);

        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        var unknownLibrary = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = Guid.NewGuid(), destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(unknownLibrary, HttpStatusCode.NotFound);

        var foreignFolder = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = libraryId, destinationFolderId = foreignFolderId });
        await TestSupport.AssertProblemAsync(foreignFolder, HttpStatusCode.Conflict);

        var missingFolder = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = libraryId, destinationFolderId = Guid.NewGuid() });
        await TestSupport.AssertProblemAsync(missingFolder, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Move_requires_contribute_on_source_and_destination()
    {
        var adminEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, adminEmail, "Password1!", isAdmin: true);
        var (adminToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), adminEmail, "Password1!");
        using var admin = TestSupport.AuthorizedClient(_factory, adminToken);
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "doc.txt", "v1");

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);

        var moveResponse = await other.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = libraryId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(moveResponse, HttpStatusCode.Forbidden);

        var copyResponse = await other.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId = libraryId, destinationFolderId = (Guid?)null });
        await TestSupport.AssertProblemAsync(copyResponse, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Move_and_copy_are_audited()
    {
        var (client, siteId, libraryId) = await AdminAsync();
        var archiveId = await CreateLibraryAsync(client, siteId, "Archive");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/copy",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });
        await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/move",
            new { destinationLibraryId = archiveId, destinationFolderId = (Guid?)null });

        var auditLog = await (await client.GetAsync($"/api/v1/sites/{siteId}/audit-log"))
            .Content.ReadFromJsonAsync<List<AuditLogDto>>();
        Assert.Contains(auditLog!, entry => entry.Action == AuditAction.Copy.ToString() && entry.ObjectName == "doc.txt");
        Assert.Contains(auditLog!, entry => entry.Action == AuditAction.Move.ToString() && entry.ObjectName == "doc.txt");
    }
}
