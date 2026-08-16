using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Groups;
using eDMS.Application.Permissions;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class GroupsAndPermissionsApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public GroupsAndPermissionsApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task Global_group_lifecycle()
    {
        using var client = await AdminAsync();

        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/groups",
            new { name = "Auditors", description = "Global", siteId = (Guid?)null });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var groupId = Guid.Parse((await createResponse.Content.ReadAsStringAsync()).Trim('"'));

        var duplicate = await client.PostAsJsonAsync(
            "/api/v1/groups",
            new { name = "Auditors", description = (string?)null, siteId = (Guid?)null });
        await TestSupport.AssertProblemAsync(duplicate, HttpStatusCode.Conflict);

        var invalid = await client.PostAsJsonAsync(
            "/api/v1/groups",
            new { name = "", description = (string?)null, siteId = (Guid?)null });
        await TestSupport.AssertProblemAsync(invalid, HttpStatusCode.BadRequest);

        var memberEmail = TestSupport.UniqueEmail();
        var member = await TestSupport.SeedUserAsync(_factory, memberEmail, "Password1!");
        var addMember = await client.PostAsync($"/api/v1/groups/{groupId}/members/{member.Id}", null);
        Assert.Equal(HttpStatusCode.NoContent, addMember.StatusCode);

        var addAgain = await client.PostAsync($"/api/v1/groups/{groupId}/members/{member.Id}", null);
        Assert.Equal(HttpStatusCode.NoContent, addAgain.StatusCode);

        var listResponse = await client.GetAsync("/api/v1/groups");
        var groups = await listResponse.Content.ReadFromJsonAsync<List<GroupDto>>();
        var listed = groups!.Single(group => group.Id == groupId);
        Assert.Contains(member.Id, listed.MemberIds);

        var removeMember = await client.DeleteAsync($"/api/v1/groups/{groupId}/members/{member.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeMember.StatusCode);

        var deleteResponse = await client.DeleteAsync($"/api/v1/groups/{groupId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var deleteUnknown = await client.DeleteAsync($"/api/v1/groups/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(deleteUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Non_admin_cannot_create_global_group()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/groups",
            new { name = "Sneaky", description = (string?)null, siteId = (Guid?)null });
        await TestSupport.AssertProblemAsync(createResponse, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Site_owner_can_manage_site_group_and_builtin_groups_cannot_be_deleted()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);
        var (siteId, _) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/groups",
            new { name = "Editors", description = (string?)null, siteId });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var groupId = Guid.Parse((await createResponse.Content.ReadAsStringAsync()).Trim('"'));

        var siteGroups = await (await client.GetAsync($"/api/v1/groups?siteId={siteId}"))
            .Content.ReadFromJsonAsync<List<GroupDto>>();
        Assert.Contains(siteGroups!, group => group.Id == groupId);
        var builtin = siteGroups!.First(group => group.IsSystem);

        var deleteBuiltin = await client.DeleteAsync($"/api/v1/groups/{builtin.Id}");
        await TestSupport.AssertProblemAsync(deleteBuiltin, HttpStatusCode.Conflict);

        var deleteGroup = await client.DeleteAsync($"/api/v1/groups/{groupId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteGroup.StatusCode);
    }

    [Fact]
    public async Task Permissions_grant_revoke_reset_and_share()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        var documentId = await TestSupport.UploadAsync(client, libraryId, "secret.txt", "data");

        var otherEmail = TestSupport.UniqueEmail();
        var otherUser = await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");

        var inherited = await (await client.GetAsync($"/api/v1/Document/objects/{documentId}/permissions"))
            .Content.ReadFromJsonAsync<GetPermissionsResponse>();
        Assert.False(inherited!.HasUniqueAcl);
        Assert.NotEmpty(inherited.Entries);

        var grant = await client.PostAsJsonAsync(
            $"/api/v1/Document/objects/{documentId}/permissions",
            new
            {
                principalType = PrincipalType.User,
                principalId = otherUser.Id,
                level = PermissionLevel.Read,
            });
        Assert.Equal(HttpStatusCode.NoContent, grant.StatusCode);

        var unique = await (await client.GetAsync($"/api/v1/Document/objects/{documentId}/permissions"))
            .Content.ReadFromJsonAsync<GetPermissionsResponse>();
        Assert.True(unique!.HasUniqueAcl);
        Assert.Contains(unique.Entries, entry => entry.PrincipalId == otherUser.Id && entry.Source == "Direct");

        var revoke = await client.DeleteAsync(
            $"/api/v1/Document/objects/{documentId}/permissions/User/{otherUser.Id}");
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        var share = await client.PostAsJsonAsync(
            $"/api/v1/Document/objects/{documentId}/share",
            new { principalId = otherUser.Id, level = PermissionLevel.Read });
        Assert.Equal(HttpStatusCode.NoContent, share.StatusCode);

        var reset = await client.PostAsync(
            $"/api/v1/Document/objects/{documentId}/permissions/reset", null);
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        var afterReset = await (await client.GetAsync($"/api/v1/Document/objects/{documentId}/permissions"))
            .Content.ReadFromJsonAsync<GetPermissionsResponse>();
        Assert.False(afterReset!.HasUniqueAcl);
    }

    [Fact]
    public async Task Permissions_require_authorization()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var objectId = Guid.NewGuid();
        var grant = await client.PostAsJsonAsync(
            $"/api/v1/Document/objects/{objectId}/permissions",
            new
            {
                principalType = PrincipalType.User,
                principalId = Guid.NewGuid(),
                level = PermissionLevel.Read,
            });
        await TestSupport.AssertProblemAsync(grant, HttpStatusCode.Forbidden);
    }
}
