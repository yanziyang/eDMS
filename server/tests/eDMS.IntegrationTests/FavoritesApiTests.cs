using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Groups;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class FavoritesApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FavoritesApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Favorite_roundtrip_supports_each_object_type()
    {
        using var admin = await AdminAsync();
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var folderId = await TestSupport.CreateFolderAsync(admin, libraryId, "Pinned folder");
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "pinned.txt", "favorite content");

        var targets = new[]
        {
            (ObjectType.Site, siteId),
            (ObjectType.Library, libraryId),
            (ObjectType.Folder, folderId),
            (ObjectType.Document, documentId),
        };

        foreach (var (objectType, objectId) in targets)
        {
            var response = await admin.PostAsync(
                $"/api/v1/{objectType}/objects/{objectId}/favorite",
                content: null);
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        var list = await (await admin.GetAsync("/api/v1/me/favorites"))
            .Content.ReadFromJsonAsync<List<FavoriteItemDto>>();

        Assert.NotNull(list);
        Assert.Equal(4, list!.Count);
        Assert.Equal(
            targets.Select(target => target.Item1.ToString()),
            list.Select(item => item.ObjectType));
        Assert.Contains(list, item => item.ObjectType == nameof(ObjectType.Site) && item.Name.StartsWith("Site "));
        Assert.Contains(list, item => item.ObjectType == nameof(ObjectType.Library) && item.Name == "Documents");
        Assert.Contains(list, item => item.ObjectType == nameof(ObjectType.Folder) && item.Name == "Pinned folder");
        Assert.Contains(list, item => item.ObjectType == nameof(ObjectType.Document) && item.Name == "pinned.txt");
        Assert.All(list, item => Assert.False(string.IsNullOrWhiteSpace(item.Location)));

        foreach (var (objectType, objectId) in targets)
        {
            var response = await admin.DeleteAsync($"/api/v1/{objectType}/objects/{objectId}/favorite");
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        var afterRemove = await (await admin.GetAsync("/api/v1/me/favorites"))
            .Content.ReadFromJsonAsync<List<FavoriteItemDto>>();
        Assert.NotNull(afterRemove);
        Assert.Empty(afterRemove!);
    }

    [Fact]
    public async Task Favorites_list_hides_an_item_after_site_access_is_revoked()
    {
        using var admin = await AdminAsync();
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var documentId = await TestSupport.UploadAsync(admin, libraryId, "restricted.txt", "restricted content");

        var userEmail = TestSupport.UniqueEmail();
        var user = await TestSupport.SeedUserAsync(_factory, userEmail, "Password1!");
        using var userClient = await AuthorizedClientAsync(userEmail);

        var groups = await (await admin.GetAsync($"/api/v1/groups?siteId={siteId}"))
            .Content.ReadFromJsonAsync<List<GroupDto>>();
        var visitors = Assert.Single(groups!, group => group.Name.Contains("Visitors"));
        var addMember = await admin.PostAsync(
            $"/api/v1/groups/{visitors.Id}/members/{user.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, addMember.StatusCode);

        var favorite = await userClient.PostAsync(
            $"/api/v1/Document/objects/{documentId}/favorite",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, favorite.StatusCode);

        var visible = await (await userClient.GetAsync("/api/v1/me/favorites"))
            .Content.ReadFromJsonAsync<List<FavoriteItemDto>>();
        var visibleItem = Assert.Single(visible!);
        Assert.Equal("restricted.txt", visibleItem.Name);

        var removeMember = await admin.DeleteAsync(
            $"/api/v1/groups/{visitors.Id}/members/{user.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeMember.StatusCode);

        var hidden = await (await userClient.GetAsync("/api/v1/me/favorites"))
            .Content.ReadFromJsonAsync<List<FavoriteItemDto>>();
        Assert.NotNull(hidden);
        Assert.Empty(hidden!);
    }

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    private async Task<HttpClient> AuthorizedClientAsync(string email)
    {
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    private sealed record FavoriteItemDto(
        Guid ObjectId,
        string ObjectType,
        string Name,
        string Location,
        string SiteSlug,
        Guid? LibraryId,
        Guid? FolderId);
}
