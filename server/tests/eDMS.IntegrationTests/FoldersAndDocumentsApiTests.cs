using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using eDMS.Application.Documents;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class FoldersAndDocumentsApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FoldersAndDocumentsApiTests(ApiFactory factory) => _factory = factory;

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
    public async Task Folder_lifecycle_root_nested_rename_delete()
    {
        var (client, _, libraryId) = await AdminAsync();

        var rootId = await TestSupport.CreateFolderAsync(client, libraryId, "Root");
        var childId = await TestSupport.CreateChildFolderAsync(client, libraryId, rootId, "Child");

        var itemsResponse = await client.GetAsync($"/api/v1/folders/{rootId}/items");
        Assert.Equal(HttpStatusCode.OK, itemsResponse.StatusCode);
        var items = await itemsResponse.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(items!, item => item.Kind == "folder" && item.Id == childId);

        var renameResponse = await client.PutAsJsonAsync($"/api/v1/folders/{rootId}", new { name = "Renamed" });
        Assert.Equal(HttpStatusCode.NoContent, renameResponse.StatusCode);

        var renameChild = await client.PutAsJsonAsync($"/api/v1/folders/{childId}", new { name = "Child2" });
        Assert.Equal(HttpStatusCode.NoContent, renameChild.StatusCode);

        var deleteResponse = await client.DeleteAsync($"/api/v1/folders/{rootId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missingItems = await client.GetAsync($"/api/v1/folders/{rootId}/items");
        Assert.Equal(HttpStatusCode.OK, missingItems.StatusCode);
    }

    [Fact]
    public async Task Child_folder_creation_derives_library_from_parent()
    {
        var (admin, siteId, libraryId) = await AdminAsync();
        var rootId = await TestSupport.CreateFolderAsync(admin, libraryId, "Root");

        // The frontend sends only { name } for child folders; the library must be
        // derived from the parent rather than required in the body.
        var noLibraryBody = await admin.PostAsJsonAsync(
            $"/api/v1/folders/{rootId}/folders",
            new { name = "Child Without Library" });
        Assert.Equal(HttpStatusCode.Created, noLibraryBody.StatusCode);

        // A libraryId claimed in the body is ignored: the parent's library wins, so a
        // child folder cannot be created under one library while its parent lives in
        // another (which would break the folder hierarchy's storage scoping).
        var libraryResponse = await admin.PostAsJsonAsync(
            $"/api/v1/sites/{siteId}/libraries",
            new
            {
                name = "Other Library",
                description = (string?)null,
                enableVersioning = true,
                enableMinorVersions = false,
                requireCheckout = false,
            });
        Assert.Equal(HttpStatusCode.Created, libraryResponse.StatusCode);
        var otherLibraryId = Guid.Parse(
            (await libraryResponse.Content.ReadAsStringAsync()).Trim('"'));

        var claimed = await admin.PostAsJsonAsync(
            $"/api/v1/folders/{rootId}/folders",
            new { name = "Claimed Library", libraryId = otherLibraryId });
        Assert.Equal(HttpStatusCode.Created, claimed.StatusCode);
        var claimedFolderId = Guid.Parse(
            (await claimed.Content.ReadAsStringAsync()).Trim('"'));

        var rootItems = await (await admin.GetAsync($"/api/v1/folders/{rootId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(rootItems!, item => item.Kind == "folder" && item.Id == claimedFolderId);

        var otherItems = await (await admin.GetAsync($"/api/v1/libraries/{otherLibraryId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.DoesNotContain(otherItems!, item => item.Id == claimedFolderId);
    }

    [Fact]
    public async Task Folder_error_paths()
    {
        var (client, _, libraryId) = await AdminAsync();

        var unknownList = await client.GetAsync($"/api/v1/folders/{Guid.NewGuid()}/items");
        await TestSupport.AssertProblemAsync(unknownList, HttpStatusCode.NotFound);

        var renameUnknown = await client.PutAsJsonAsync($"/api/v1/folders/{Guid.NewGuid()}", new { name = "X" });
        await TestSupport.AssertProblemAsync(renameUnknown, HttpStatusCode.NotFound);

        var deleteUnknown = await client.DeleteAsync($"/api/v1/folders/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(deleteUnknown, HttpStatusCode.NotFound);

        var childOfUnknown = await client.PostAsJsonAsync(
            $"/api/v1/folders/{Guid.NewGuid()}/folders",
            new { name = "X", libraryId });
        await TestSupport.AssertProblemAsync(childOfUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Upload_download_preview_rename_and_delete_document()
    {
        var (client, _, libraryId) = await AdminAsync();

        var documentId = await TestSupport.UploadAsync(client, libraryId, "notes.txt", "hello e2e");

        var getResponse = await client.GetAsync($"/api/v1/documents/{documentId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var document = await getResponse.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.Equal("notes.txt", document!.Name);
        Assert.Equal("1.0", document.VersionLabel);
        Assert.Equal("application/octet-stream", document.ContentType);

        var downloadResponse = await client.GetAsync($"/api/v1/documents/{documentId}/download");
        Assert.Equal(HttpStatusCode.OK, downloadResponse.StatusCode);
        Assert.Equal("hello e2e", await downloadResponse.Content.ReadAsStringAsync());

        var previewResponse = await client.GetAsync($"/api/v1/documents/{documentId}/preview");
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);

        var renameResponse = await client.PutAsJsonAsync(
            $"/api/v1/documents/{documentId}",
            new { name = "renamed.txt", title = (string?)null, description = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, renameResponse.StatusCode);

        var metadataResponse = await client.PutAsJsonAsync(
            $"/api/v1/documents/{documentId}",
            new { name = (string?)null, title = "T", description = "D" });
        Assert.Equal(HttpStatusCode.NoContent, metadataResponse.StatusCode);

        var updated = await (await client.GetAsync($"/api/v1/documents/{documentId}"))
            .Content.ReadFromJsonAsync<DocumentDto>();
        Assert.Equal("renamed.txt", updated!.Name);
        Assert.Equal("T", updated.Title);
        Assert.Equal("D", updated.Description);

        var deleteResponse = await client.DeleteAsync($"/api/v1/documents/{documentId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var trulyMissing = await client.GetAsync($"/api/v1/documents/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(trulyMissing, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Reupload_creates_new_version_and_blocked_extension_is_rejected()
    {
        var (client, _, libraryId) = await AdminAsync();

        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");

        var versionsResponse = await client.GetAsync($"/api/v1/documents/{documentId}/versions");
        var versions = await versionsResponse.Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal(2, versions!.Count);
        Assert.Contains(versions, version => version.VersionMajor == 2);

        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent("MZ"u8.ToArray());
        multipart.Add(fileContent, "file", "evil.exe");
        var blocked = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", multipart);
        await TestSupport.AssertProblemAsync(blocked, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Upload_to_folder_lands_in_that_folder()
    {
        var (client, _, libraryId) = await AdminAsync();
        var folderId = await TestSupport.CreateFolderAsync(client, libraryId, "Docs");

        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent("content"u8.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        multipart.Add(fileContent, "file", "in-folder.txt");
        var response = await client.PostAsync($"/api/v1/folders/{folderId}/documents", multipart);
        response.EnsureSuccessStatusCode();

        var items = await (await client.GetAsync($"/api/v1/folders/{folderId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(items!, item => item.Kind == "document" && item.Name == "in-folder.txt");
    }

    [Fact]
    public async Task Checkout_checkin_and_discard_flows()
    {
        var (client, _, libraryId) = await AdminAsync();
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        var checkout = await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        Assert.Equal(HttpStatusCode.NoContent, checkout.StatusCode);

        var checkin = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/checkin",
            new { comment = "done" });
        Assert.Equal(HttpStatusCode.NoContent, checkin.StatusCode);

        var checkinAgain = await client.PostAsJsonAsync($"/api/v1/documents/{documentId}/checkin", new { comment = (string?)null });
        await TestSupport.AssertProblemAsync(checkinAgain, HttpStatusCode.Conflict);

        await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        var discard = await client.PostAsync($"/api/v1/documents/{documentId}/discard-checkout", null);
        Assert.Equal(HttpStatusCode.NoContent, discard.StatusCode);

        var versions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal("done", versions![0].Comment);
    }

    [Fact]
    public async Task Restore_version_creates_newer_major_version()
    {
        var (client, _, libraryId) = await AdminAsync();
        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");
        var documentId = await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v2");

        var versions = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        var firstVersionId = versions!.Single(version => version.VersionMajor == 1).Id;

        var restore = await client.PostAsync(
            $"/api/v1/documents/{documentId}/versions/{firstVersionId}/restore", null);
        Assert.Equal(HttpStatusCode.NoContent, restore.StatusCode);

        var after = await (await client.GetAsync($"/api/v1/documents/{documentId}/versions"))
            .Content.ReadFromJsonAsync<List<DocumentVersionDto>>();
        Assert.Equal(3, after!.Count);
        Assert.Contains(after, version => version.VersionMajor == 3);

        var restoreUnknown = await client.PostAsync(
            $"/api/v1/documents/{documentId}/versions/{Guid.NewGuid()}/restore", null);
        await TestSupport.AssertProblemAsync(restoreUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Document_error_paths()
    {
        var (client, _, libraryId) = await AdminAsync();
        var unknown = Guid.NewGuid();

        foreach (var request in new Func<Task<HttpResponseMessage>>[]
        {
            () => client.GetAsync($"/api/v1/documents/{unknown}"),
            () => client.GetAsync($"/api/v1/documents/{unknown}/download"),
            () => client.DeleteAsync($"/api/v1/documents/{unknown}"),
            () => client.PostAsync($"/api/v1/documents/{unknown}/checkout", null),
            () => client.PutAsJsonAsync($"/api/v1/documents/{unknown}", new { name = (string?)null, title = (string?)null, description = (string?)null }),
        })
        {
            var response = await request();
            await TestSupport.AssertProblemAsync(response, HttpStatusCode.NotFound);
        }

        var versionsOfUnknown = await client.GetAsync($"/api/v1/documents/{unknown}/versions");
        Assert.Equal(HttpStatusCode.OK, versionsOfUnknown.StatusCode);
    }

    [Fact]
    public async Task Library_items_lists_folders_and_documents()
    {
        var (client, _, libraryId) = await AdminAsync();
        await TestSupport.CreateFolderAsync(client, libraryId, "My Folder");
        await TestSupport.UploadAsync(client, libraryId, "my-doc.txt", "data");

        var items = await (await client.GetAsync($"/api/v1/libraries/{libraryId}/items"))
            .Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.Contains(items!, item => item.Kind == "folder" && item.Name == "My Folder");
        Assert.Contains(items!, item => item.Kind == "document" && item.Name == "my-doc.txt");
        Assert.All(items!, item => Assert.Equal(nameof(PermissionLevel.FullControl), item.PermissionLevel));
    }
}
