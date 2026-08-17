using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using eDMS.Application.Notifications;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class NotificationsApiTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public NotificationsApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Follow_list_update_and_unfollow_round_trip()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        var documentId = await TestSupport.UploadAsync(client, libraryId, "followed.txt", "body");

        var follow = await client.PostAsJsonAsync(
            $"/api/v1/Document/objects/{documentId}/follow",
            new { frequency = AlertFrequency.Daily });
        Assert.Equal(HttpStatusCode.OK, follow.StatusCode);
        var subscription = await follow.Content.ReadFromJsonAsync<AlertSubscriptionDto>(JsonOptions);
        Assert.Equal(AlertFrequency.Daily, subscription!.Frequency);

        var list = await client.GetFromJsonAsync<List<AlertSubscriptionDto>>(
            "/api/v1/me/notifications/subscriptions",
            JsonOptions);
        Assert.Contains(list!, item => item.ObjectId == documentId);

        var update = await client.PostAsJsonAsync(
            $"/api/v1/Document/objects/{documentId}/follow",
            new { frequency = AlertFrequency.Weekly });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal(
            AlertFrequency.Weekly,
            (await update.Content.ReadFromJsonAsync<AlertSubscriptionDto>(JsonOptions))!.Frequency);

        var unfollow = await client.DeleteAsync($"/api/v1/Document/objects/{documentId}/follow");
        Assert.Equal(HttpStatusCode.NoContent, unfollow.StatusCode);
        list = await client.GetFromJsonAsync<List<AlertSubscriptionDto>>(
            "/api/v1/me/notifications/subscriptions",
            JsonOptions);
        Assert.DoesNotContain(list!, item => item.ObjectId == documentId);
    }

    [Fact]
    public async Task Sharing_creates_recipient_notification()
    {
        var ownerEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, ownerEmail, "Password1!", isAdmin: true);
        var (ownerToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), ownerEmail, "Password1!");
        using var owner = TestSupport.AuthorizedClient(_factory, ownerToken);
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(owner);
        var documentId = await TestSupport.UploadAsync(owner, libraryId, "shared.txt", "body");

        var recipientEmail = TestSupport.UniqueEmail();
        var recipient = await TestSupport.SeedUserAsync(_factory, recipientEmail, "Password1!");

        var share = await owner.PostAsJsonAsync(
            $"/api/v1/Document/objects/{documentId}/share",
            new { principalId = recipient.Id, level = PermissionLevel.Read });
        Assert.Equal(HttpStatusCode.NoContent, share.StatusCode);

        var (recipientToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), recipientEmail, "Password1!");
        using var recipientClient = TestSupport.AuthorizedClient(_factory, recipientToken);
        var notifications = await recipientClient.GetFromJsonAsync<List<NotificationDto>>(
            "/api/v1/me/notifications",
            JsonOptions);
        Assert.Contains(notifications!, item =>
            item.Kind == NotificationKind.SharedWithMe && item.ObjectId == documentId);
    }
}
