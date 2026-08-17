using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Groups;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.IntegrationTests;

public sealed class RecentApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public RecentApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Recent_returns_latest_per_document_in_order_and_filters_lost_access()
    {
        using var admin = await AdminAsync();
        var first = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var second = await TestSupport.CreateSiteWithLibraryAsync(admin);
        var firstDocumentId = await TestSupport.UploadAsync(admin, first.LibraryId, "first.txt", "first");
        var secondDocumentId = await TestSupport.UploadAsync(admin, second.LibraryId, "second.txt", "second");

        var userEmail = TestSupport.UniqueEmail();
        var user = await TestSupport.SeedUserAsync(_factory, userEmail, "Password1!");
        using var userClient = await AuthorizedClientAsync(userEmail);
        var firstVisitors = await AddVisitorMemberAsync(admin, first.SiteId, user.Id);
        var secondVisitors = await AddVisitorMemberAsync(admin, second.SiteId, user.Id);

        var now = DateTimeOffset.UtcNow;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AuditLogEntries.AddRange(
                Audit(firstDocumentId, first.SiteId, user.Id, now.AddMinutes(-3), AuditAction.View, "first-old"),
                Audit(secondDocumentId, second.SiteId, user.Id, now.AddMinutes(-2), AuditAction.Upload, "second"),
                Audit(firstDocumentId, first.SiteId, user.Id, now.AddMinutes(-1), AuditAction.EditMetadata, "first-latest"));
            await db.SaveChangesAsync();
        }

        var initialResponse = await userClient.GetAsync("/api/v1/me/recent");
        Assert.True(
            initialResponse.IsSuccessStatusCode,
            $"Recent response was {(int)initialResponse.StatusCode}: {await initialResponse.Content.ReadAsStringAsync()}");
        var initial = await initialResponse.Content.ReadFromJsonAsync<List<RecentDocumentDto>>();
        Assert.NotNull(initial);
        Assert.Equal(2, initial!.Count);
        Assert.Equal(firstDocumentId, initial[0].DocumentId);
        Assert.Equal(secondDocumentId, initial[1].DocumentId);
        Assert.Equal("first.txt", initial[0].Name);
        Assert.Equal("second.txt", initial[1].Name);
        Assert.Equal("EditMetadata", initial[0].LastAction);
        Assert.Equal("Upload", initial[1].LastAction);
        Assert.Equal(first.SiteId, initial[0].SiteId);
        Assert.Equal(second.SiteId, initial[1].SiteId);

        var removeMember = await admin.DeleteAsync(
            $"/api/v1/groups/{secondVisitors.Id}/members/{user.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeMember.StatusCode);

        var afterRevoke = await (await userClient.GetAsync("/api/v1/me/recent"))
            .Content.ReadFromJsonAsync<List<RecentDocumentDto>>();
        Assert.NotNull(afterRevoke);
        var visible = Assert.Single(afterRevoke!);
        Assert.Equal(firstDocumentId, visible.DocumentId);
        Assert.DoesNotContain(afterRevoke!, item => item.Name == "second.txt");

        var removeFirstMember = await admin.DeleteAsync(
            $"/api/v1/groups/{firstVisitors.Id}/members/{user.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeFirstMember.StatusCode);
    }

    private static AuditLogEntry Audit(
        Guid documentId,
        Guid siteId,
        Guid userId,
        DateTimeOffset timestamp,
        AuditAction action,
        string objectName) => new()
        {
            Id = Guid.NewGuid(),
            Timestamp = timestamp,
            UserId = userId,
            Action = action,
            ObjectType = ObjectType.Document,
            ObjectId = documentId,
            ObjectName = objectName,
            SiteId = siteId,
        };

    private async Task<GroupDto> AddVisitorMemberAsync(HttpClient admin, Guid siteId, Guid userId)
    {
        var groups = await (await admin.GetAsync($"/api/v1/groups?siteId={siteId}"))
            .Content.ReadFromJsonAsync<List<GroupDto>>();
        var visitors = Assert.Single(groups!, group => group.Name.Contains("Visitors"));
        var response = await admin.PostAsync(
            $"/api/v1/groups/{visitors.Id}/members/{userId}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        return visitors;
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

    private sealed record RecentDocumentDto(
        Guid DocumentId,
        string Name,
        Guid SiteId,
        string SiteName,
        string SiteSlug,
        Guid LibraryId,
        string LibraryName,
        Guid? FolderId,
        string? FolderPath,
        DateTimeOffset LastTouchedAt,
        string LastAction);

}
