using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using eDMS.Application.Sharing;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class ShareLinkApiTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions ApiJsonOptions = new(JsonSerializerOptions.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public ShareLinkApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task Share_link_grants_access_without_an_acl_entry_until_revoked()
    {
        using var admin = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "linked.txt", "data");

        var create = await admin.PostAsJsonAsync(
            "/api/v1/Document/objects/" + documentId + "/share-links",
            new { level = PermissionLevel.Read, expiresAt = (DateTimeOffset?)null });
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        var link = await create.Content.ReadFromJsonAsync<ShareLinkDto>(ApiJsonOptions);
        Assert.NotNull(link);
        Assert.NotNull(link!.Token);
        Assert.Equal(32, Convert.FromBase64String(link.Token.Replace('-', '+').Replace('_', '/').PadRight(44, '=')).Length);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");

        // Without the token: no access.
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);
        var withoutToken = await other.GetAsync($"/api/v1/documents/{documentId}");
        await TestSupport.AssertProblemAsync(withoutToken, HttpStatusCode.Forbidden);

        // With the token header: the link grants Read.
        other.DefaultRequestHeaders.Add("X-Share-Token", link.Token);
        var withToken = await other.GetAsync($"/api/v1/documents/{documentId}");
        Assert.Equal(HttpStatusCode.OK, withToken.StatusCode);

        // Contribute operations are still blocked by a Read link.
        var checkout = await other.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        await TestSupport.AssertProblemAsync(checkout, HttpStatusCode.Forbidden);

        // Revoking blocks further access.
        var links = await (await admin.GetAsync("/api/v1/Document/objects/" + documentId + "/share-links"))
            .Content.ReadFromJsonAsync<List<ShareLinkDto>>(ApiJsonOptions);
        var revoke = await admin.DeleteAsync($"/api/v1/share-links/{links![0].Id}");
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        var afterRevoke = await other.GetAsync($"/api/v1/documents/{documentId}");
        await TestSupport.AssertProblemAsync(afterRevoke, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Expired_share_link_is_ignored()
    {
        using var admin = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "expiring.txt", "data");

        var create = await admin.PostAsJsonAsync(
            "/api/v1/Document/objects/" + documentId + "/share-links",
            new { level = PermissionLevel.Read, expiresAt = DateTimeOffset.UtcNow.AddMinutes(-1) });
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        var link = await create.Content.ReadFromJsonAsync<ShareLinkDto>(ApiJsonOptions);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);
        other.DefaultRequestHeaders.Add("X-Share-Token", link!.Token);

        var response = await other.GetAsync($"/api/v1/documents/{documentId}");
        await TestSupport.AssertProblemAsync(response, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Share_link_for_a_different_object_does_not_grant_access()
    {
        using var admin = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "one.txt", "data");
        var otherDocumentId = await TestSupport.UploadAsync(admin, libraryId, "two.txt", "data");

        var create = await admin.PostAsJsonAsync(
            "/api/v1/Document/objects/" + documentId + "/share-links",
            new { level = PermissionLevel.Read, expiresAt = (DateTimeOffset?)null });
        var link = await create.Content.ReadFromJsonAsync<ShareLinkDto>(ApiJsonOptions);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);
        other.DefaultRequestHeaders.Add("X-Share-Token", link!.Token);

        var blocked = await other.GetAsync($"/api/v1/documents/{otherDocumentId}");
        await TestSupport.AssertProblemAsync(blocked, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Share_link_creation_requires_full_control_and_valid_level()
    {
        using var admin = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "perm.txt", "data");

        var invalidLevel = await admin.PostAsJsonAsync(
            "/api/v1/Document/objects/" + documentId + "/share-links",
            new { level = PermissionLevel.FullControl, expiresAt = (DateTimeOffset?)null });
        await TestSupport.AssertProblemAsync(invalidLevel, HttpStatusCode.Conflict);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);

        var forbidden = await other.PostAsJsonAsync(
            "/api/v1/Document/objects/" + documentId + "/share-links",
            new { level = PermissionLevel.Read, expiresAt = (DateTimeOffset?)null });
        await TestSupport.AssertProblemAsync(forbidden, HttpStatusCode.Forbidden);

        var revokeUnknown = await admin.DeleteAsync($"/api/v1/share-links/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(revokeUnknown, HttpStatusCode.NotFound);
    }
}
