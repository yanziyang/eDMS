using eDMS.Domain;

namespace eDMS.Application.Notifications;

public interface INotificationService
{
    Task<AlertSubscriptionDto> FollowAsync(
        ObjectType objectType,
        Guid objectId,
        AlertFrequency frequency,
        CancellationToken cancellationToken = default);

    Task UnfollowAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AlertSubscriptionDto>> ListSubscriptionsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<NotificationDto>> ListNotificationsAsync(
        bool unreadOnly,
        CancellationToken cancellationToken = default);

    Task MarkReadAsync(Guid notificationId, CancellationToken cancellationToken = default);

    Task MarkAllReadAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates inbox entries for users following the object and sends immediate
    /// alerts. This is called by domain/application write paths after their change
    /// has been persisted.
    /// </summary>
    Task PublishFollowedChangeAsync(
        ObjectType objectType,
        Guid objectId,
        string changeDescription,
        CancellationToken cancellationToken = default);

    /// <summary>Creates and emails a shared-with-me notification.</summary>
    Task PublishSharedAsync(
        Guid recipientId,
        ObjectType objectType,
        Guid objectId,
        string objectName,
        CancellationToken cancellationToken = default);

    /// <summary>Delivers due daily and weekly digest rows and returns their count.</summary>
    Task<int> DeliverDigestsAsync(CancellationToken cancellationToken = default);
}
