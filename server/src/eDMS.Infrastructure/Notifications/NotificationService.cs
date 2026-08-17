using System.Net;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Notifications;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Notifications;

public sealed class NotificationService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IEmailSender emailSender,
    TimeProvider timeProvider) : INotificationService
{
    public async Task<AlertSubscriptionDto> FollowAsync(
        ObjectType objectType,
        Guid objectId,
        AlertFrequency frequency,
        CancellationToken cancellationToken = default)
    {
        ValidateFrequency(frequency);
        EnsureFollowable(objectType);

        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var objectName = await ResolveObjectNameAsync(objectType, objectId, cancellationToken)
            ?? throw new NotFoundException(objectType.ToString(), objectId);
        await permissions.RequireAsync(userId, objectType, objectId, PermissionLevel.Read, cancellationToken);

        var subscription = await db.AlertSubscriptions.SingleOrDefaultAsync(
            item => item.UserId == userId
                && item.ObjectType == objectType
                && item.ObjectId == objectId,
            cancellationToken);

        if (subscription is null)
        {
            subscription = new AlertSubscription
            {
                UserId = userId,
                ObjectType = objectType,
                ObjectId = objectId,
                Frequency = frequency,
            };
            subscription.SetCreator(userId);
            db.AlertSubscriptions.Add(subscription);
        }
        else
        {
            subscription.Frequency = frequency;
        }

        await db.SaveChangesAsync(cancellationToken);
        return ToSubscriptionDto(subscription, objectName);
    }

    public async Task UnfollowAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default)
    {
        EnsureFollowable(objectType);
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var subscription = await db.AlertSubscriptions.SingleOrDefaultAsync(
            item => item.UserId == userId
                && item.ObjectType == objectType
                && item.ObjectId == objectId,
            cancellationToken);

        if (subscription is null)
        {
            return;
        }

        db.AlertSubscriptions.Remove(subscription);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AlertSubscriptionDto>> ListSubscriptionsAsync(
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var subscriptions = await db.AlertSubscriptions.AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.ObjectType)
            .ThenBy(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        var result = new List<AlertSubscriptionDto>(subscriptions.Count);
        foreach (var subscription in subscriptions)
        {
            var objectName = await ResolveObjectNameAsync(
                subscription.ObjectType,
                subscription.ObjectId,
                cancellationToken) ?? "Deleted item";
            result.Add(ToSubscriptionDto(subscription, objectName));
        }

        return result;
    }

    public async Task<IReadOnlyList<NotificationDto>> ListNotificationsAsync(
        bool unreadOnly,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var query = db.Notifications.AsNoTracking()
            .Where(notification => notification.UserId == userId);
        if (unreadOnly)
        {
            query = query.Where(notification => !notification.IsRead);
        }

        var notifications = await query
            .OrderByDescending(notification => notification.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        return notifications.Select(ToNotificationDto).ToList();
    }

    public async Task MarkReadAsync(Guid notificationId, CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var notification = await db.Notifications.SingleOrDefaultAsync(
            item => item.Id == notificationId && item.UserId == userId,
            cancellationToken)
            ?? throw new NotFoundException(nameof(Notification), notificationId);

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = timeProvider.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task MarkAllReadAsync(CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var notifications = await db.Notifications
            .Where(item => item.UserId == userId && !item.IsRead)
            .ToListAsync(cancellationToken);
        if (notifications.Count == 0)
        {
            return;
        }

        var now = timeProvider.GetUtcNow();
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task PublishFollowedChangeAsync(
        ObjectType objectType,
        Guid objectId,
        string changeDescription,
        CancellationToken cancellationToken = default)
    {
        if (!IsFollowable(objectType))
        {
            return;
        }

        var subscriptions = await db.AlertSubscriptions
            .Where(item => item.ObjectType == objectType && item.ObjectId == objectId)
            .ToListAsync(cancellationToken);
        if (subscriptions.Count == 0)
        {
            return;
        }

        var objectName = await ResolveObjectNameAsync(objectType, objectId, cancellationToken)
            ?? "Deleted item";
        var actorId = currentUser.UserId;
        var now = timeProvider.GetUtcNow();
        var entries = subscriptions.Select(subscription =>
        {
            var notification = new Notification
            {
                UserId = subscription.UserId,
                Kind = NotificationKind.FollowedItemChanged,
                ObjectType = objectType,
                ObjectId = objectId,
                ObjectName = objectName,
                Message = $"{objectName} {changeDescription}.",
                Frequency = subscription.Frequency,
            };
            notification.SetCreator(actorId ?? subscription.UserId);
            return notification;
        }).ToList();

        db.Notifications.AddRange(entries);
        await db.SaveChangesAsync(cancellationToken);
        await SendImmediateAsync(entries, now, cancellationToken);
    }

    public async Task PublishSharedAsync(
        Guid recipientId,
        ObjectType objectType,
        Guid objectId,
        string objectName,
        CancellationToken cancellationToken = default)
    {
        var recipient = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(user => user.Id == recipientId, cancellationToken);
        if (recipient is null)
        {
            return;
        }

        var now = timeProvider.GetUtcNow();
        var notification = new Notification
        {
            UserId = recipientId,
            Kind = NotificationKind.SharedWithMe,
            ObjectType = objectType,
            ObjectId = objectId,
            ObjectName = objectName,
            Message = $"{objectName} was shared with you.",
            Frequency = AlertFrequency.Immediate,
        };
        notification.SetCreator(currentUser.UserId ?? recipientId);
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(recipient.Email))
        {
            await emailSender.SendAsync(
                recipient.Email,
                $"{objectName} was shared with you",
                $"<p>{WebUtility.HtmlEncode(notification.Message)}</p>",
                cancellationToken);
        }

        notification.EmailSentAt = now;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> DeliverDigestsAsync(CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        var delivered = 0;
        delivered += await DeliverFrequencyAsync(AlertFrequency.Daily, now.AddDays(-1), now, cancellationToken);
        delivered += await DeliverFrequencyAsync(AlertFrequency.Weekly, now.AddDays(-7), now, cancellationToken);
        return delivered;
    }

    private async Task<int> DeliverFrequencyAsync(
        AlertFrequency frequency,
        DateTimeOffset cutoff,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var entries = await db.Notifications
            .Where(notification => notification.Frequency == frequency
                && notification.EmailSentAt == null
                && notification.CreatedAt <= cutoff)
            .OrderBy(notification => notification.CreatedAt)
            .ToListAsync(cancellationToken);
        if (entries.Count == 0)
        {
            return 0;
        }

        var userIds = entries.Select(entry => entry.UserId).Distinct().ToList();
        var users = await db.Users.AsNoTracking()
            .Where(user => userIds.Contains(user.Id))
            .ToDictionaryAsync(user => user.Id, cancellationToken);

        foreach (var group in entries.GroupBy(entry => entry.UserId))
        {
            if (users.TryGetValue(group.Key, out var user) && !string.IsNullOrWhiteSpace(user.Email))
            {
                var subject = frequency == AlertFrequency.Daily
                    ? "Your eDMS daily alert digest"
                    : "Your eDMS weekly alert digest";
                var body = string.Join(
                    "",
                    group.Select(entry =>
                        $"<li><strong>{WebUtility.HtmlEncode(entry.ObjectName)}</strong>: "
                        + $"{WebUtility.HtmlEncode(entry.Message)}</li>"));
                await emailSender.SendAsync(
                    user.Email,
                    subject,
                    $"<p>Here are your eDMS alerts:</p><ul>{body}</ul>",
                    cancellationToken);
            }

            foreach (var entry in group)
            {
                entry.EmailSentAt = now;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return entries.Count;
    }

    private async Task SendImmediateAsync(
        IReadOnlyCollection<Notification> entries,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var immediate = entries.Where(entry => entry.Frequency == AlertFrequency.Immediate).ToList();
        if (immediate.Count == 0)
        {
            return;
        }

        var userIds = immediate.Select(entry => entry.UserId).Distinct().ToList();
        var users = await db.Users.AsNoTracking()
            .Where(user => userIds.Contains(user.Id))
            .ToDictionaryAsync(user => user.Id, cancellationToken);
        foreach (var entry in immediate)
        {
            if (users.TryGetValue(entry.UserId, out var user) && !string.IsNullOrWhiteSpace(user.Email))
            {
                await emailSender.SendAsync(
                    user.Email,
                    $"eDMS alert: {entry.ObjectName}",
                    $"<p>{WebUtility.HtmlEncode(entry.Message)}</p>",
                    cancellationToken);
            }

            entry.EmailSentAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string?> ResolveObjectNameAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken) => objectType switch
        {
            ObjectType.Document => await db.Documents.IgnoreQueryFilters()
                .Where(document => document.Id == objectId)
                .Select(document => document.Name)
                .SingleOrDefaultAsync(cancellationToken),
            ObjectType.Folder => await db.Folders.IgnoreQueryFilters()
                .Where(folder => folder.Id == objectId)
                .Select(folder => folder.Name)
                .SingleOrDefaultAsync(cancellationToken),
            _ => null,
        };

    private static AlertSubscriptionDto ToSubscriptionDto(
        AlertSubscription subscription,
        string objectName) => new(
            subscription.Id,
            subscription.ObjectType,
            subscription.ObjectId,
            objectName,
            subscription.Frequency,
            subscription.CreatedAt);

    private static NotificationDto ToNotificationDto(Notification notification) => new(
        notification.Id,
        notification.Kind,
        notification.ObjectType,
        notification.ObjectId,
        notification.ObjectName,
        notification.Message,
        notification.Frequency,
        notification.CreatedAt,
        notification.IsRead);

    private static void EnsureFollowable(ObjectType objectType)
    {
        if (!IsFollowable(objectType))
        {
            throw new ConflictException("Only documents and folders can be followed.");
        }
    }

    private static bool IsFollowable(ObjectType objectType) =>
        objectType is ObjectType.Document or ObjectType.Folder;

    private static void ValidateFrequency(AlertFrequency frequency)
    {
        if (!Enum.IsDefined(frequency))
        {
            throw new ConflictException("Unknown alert frequency.");
        }
    }
}
