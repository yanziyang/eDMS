using eDMS.Application.Notifications;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class NotificationsController(INotificationService notifications) : ControllerBase
{
    [HttpPost("{objectType}/objects/{id:guid}/follow")]
    public async Task<IActionResult> Follow(
        ObjectType objectType,
        Guid id,
        [FromBody] FollowRequest request,
        CancellationToken cancellationToken) =>
        Ok(await notifications.FollowAsync(objectType, id, request.Frequency, cancellationToken));

    [HttpDelete("{objectType}/objects/{id:guid}/follow")]
    public async Task<IActionResult> Unfollow(
        ObjectType objectType,
        Guid id,
        CancellationToken cancellationToken)
    {
        await notifications.UnfollowAsync(objectType, id, cancellationToken);
        return NoContent();
    }

    [HttpGet("me/notifications")]
    public async Task<IActionResult> ListNotifications(
        [FromQuery] bool unreadOnly = false,
        CancellationToken cancellationToken = default) =>
        Ok(await notifications.ListNotificationsAsync(unreadOnly, cancellationToken));

    [HttpPost("me/notifications/{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        await notifications.MarkReadAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("me/notifications/read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await notifications.MarkAllReadAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("me/notifications/subscriptions")]
    public async Task<IActionResult> ListSubscriptions(CancellationToken cancellationToken) =>
        Ok(await notifications.ListSubscriptionsAsync(cancellationToken));
}
