using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Groups;
using eDMS.Application.LibraryViews;

namespace eDMS.IntegrationTests;

public sealed class LibraryViewsApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public LibraryViewsApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Personal_views_are_private_and_only_full_control_can_set_a_shared_default()
    {
        using var admin = await AdminAsync();
        var (siteId, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);

        var firstEmail = TestSupport.UniqueEmail();
        var firstUser = await TestSupport.SeedUserAsync(_factory, firstEmail, "Password1!");
        var secondEmail = TestSupport.UniqueEmail();
        var secondUser = await TestSupport.SeedUserAsync(_factory, secondEmail, "Password1!");
        using var firstClient = await AuthorizedClientAsync(firstEmail);
        using var secondClient = await AuthorizedClientAsync(secondEmail);

        await AddVisitorMemberAsync(admin, siteId, firstUser.Id);
        await AddVisitorMemberAsync(admin, siteId, secondUser.Id);

        var personalResponse = await firstClient.PostAsJsonAsync(
            $"/api/v1/libraries/{libraryId}/views",
            new
            {
                name = "My filtered documents",
                filterConfig = "{\"text\":\"contract\"}",
                sortConfig = "{\"key\":\"name\",\"descending\":false}",
                groupByColumn = "kind",
                isShared = false,
            });
        Assert.Equal(HttpStatusCode.Created, personalResponse.StatusCode);
        var personal = await personalResponse.Content.ReadFromJsonAsync<LibraryViewDto>();
        Assert.NotNull(personal);
        Assert.Equal(firstUser.Id, personal!.OwnerId);
        Assert.False(personal.IsDefault);

        var sharedResponse = await admin.PostAsJsonAsync(
            $"/api/v1/libraries/{libraryId}/views",
            new
            {
                name = "All documents",
                filterConfig = "{}",
                sortConfig = "{\"key\":\"name\",\"descending\":false}",
                groupByColumn = (string?)null,
                isShared = true,
            });
        Assert.Equal(HttpStatusCode.Created, sharedResponse.StatusCode);
        var shared = await sharedResponse.Content.ReadFromJsonAsync<LibraryViewDto>();
        Assert.NotNull(shared);
        Assert.Null(shared!.OwnerId);

        var secondViews = await (await secondClient.GetAsync($"/api/v1/libraries/{libraryId}/views"))
            .Content.ReadFromJsonAsync<List<LibraryViewDto>>();
        Assert.NotNull(secondViews);
        var visibleShared = Assert.Single(secondViews!, view => view.Id == shared.Id);
        Assert.Null(visibleShared.OwnerId);
        Assert.DoesNotContain(secondViews!, view => view.Id == personal.Id);

        var deniedDefault = await secondClient.PostAsync(
            $"/api/v1/libraries/{libraryId}/views/{shared.Id}/set-default",
            content: null);
        await TestSupport.AssertProblemAsync(deniedDefault, HttpStatusCode.Forbidden);

        var setDefault = await admin.PostAsync(
            $"/api/v1/libraries/{libraryId}/views/{shared.Id}/set-default",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, setDefault.StatusCode);

        var afterDefault = await (await secondClient.GetAsync($"/api/v1/libraries/{libraryId}/views"))
            .Content.ReadFromJsonAsync<List<LibraryViewDto>>();
        Assert.NotNull(afterDefault);
        Assert.True(Assert.Single(afterDefault!, view => view.Id == shared.Id).IsDefault);
    }

    private async Task<Guid> AddVisitorMemberAsync(HttpClient admin, Guid siteId, Guid userId)
    {
        var groups = await (await admin.GetAsync($"/api/v1/groups?siteId={siteId}"))
            .Content.ReadFromJsonAsync<List<GroupDto>>();
        var visitors = Assert.Single(groups!, group => group.Name.Contains("Visitors"));
        var response = await admin.PostAsync(
            $"/api/v1/groups/{visitors.Id}/members/{userId}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        return userId;
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
}
