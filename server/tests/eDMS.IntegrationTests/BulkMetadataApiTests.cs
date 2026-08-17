using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Documents;
using eDMS.Application.Permissions;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class BulkMetadataApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public BulkMetadataApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Bulk_metadata_updates_editable_items_and_reports_checked_out_items()
    {
        var ownerEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, ownerEmail, "Password1!", isAdmin: true);
        var (ownerToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), ownerEmail, "Password1!");
        using var owner = TestSupport.AuthorizedClient(_factory, ownerToken);
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(owner);
        var editableId = await TestSupport.UploadAsync(owner, libraryId, "editable.txt", "one");
        var lockedId = await TestSupport.UploadAsync(owner, libraryId, "locked.txt", "two");

        var checkout = await owner.PostAsync($"/api/v1/documents/{lockedId}/checkout", null);
        Assert.Equal(HttpStatusCode.NoContent, checkout.StatusCode);

        var editorEmail = TestSupport.UniqueEmail();
        var editorUser = await TestSupport.SeedUserAsync(_factory, editorEmail, "Password1!");
        var grant = await owner.PostAsJsonAsync(
            $"/api/v1/Library/objects/{libraryId}/permissions",
            new
            {
                principalType = PrincipalType.User,
                principalId = editorUser.Id,
                level = PermissionLevel.Contribute,
            });
        Assert.Equal(HttpStatusCode.NoContent, grant.StatusCode);

        var (editorToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), editorEmail, "Password1!");
        using var editor = TestSupport.AuthorizedClient(_factory, editorToken);
        var response = await editor.PutAsJsonAsync(
            "/api/v1/documents/bulk-metadata",
            new
            {
                documentIds = new[] { editableId, lockedId },
                updateTitle = true,
                title = "Bulk title",
                updateDescription = false,
                description = (string?)null,
                updateTags = false,
                tags = (string[]?)null,
                columns = Array.Empty<object>(),
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<BulkMetadataUpdateResult>();
        Assert.NotNull(result);
        Assert.Equal("updated", result!.Items.Single(item => item.DocumentId == editableId).Status);
        Assert.Equal(
            "checked-out-by-other-user",
            result.Items.Single(item => item.DocumentId == lockedId).RejectionReason);

        var editable = await (await owner.GetAsync($"/api/v1/documents/{editableId}"))
            .Content.ReadFromJsonAsync<DocumentDto>();
        var locked = await (await owner.GetAsync($"/api/v1/documents/{lockedId}"))
            .Content.ReadFromJsonAsync<DocumentDto>();
        Assert.Equal("Bulk title", editable!.Title);
        Assert.Null(locked!.Title);
    }
}
