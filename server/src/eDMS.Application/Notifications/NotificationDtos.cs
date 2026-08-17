using eDMS.Domain;

namespace eDMS.Application.Notifications;

public sealed record AlertSubscriptionDto(
    Guid Id,
    ObjectType ObjectType,
    Guid ObjectId,
    string ObjectName,
    AlertFrequency Frequency,
    DateTimeOffset CreatedAt);

public sealed record NotificationDto(
    Guid Id,
    NotificationKind Kind,
    ObjectType ObjectType,
    Guid ObjectId,
    string ObjectName,
    string Message,
    AlertFrequency Frequency,
    DateTimeOffset OccurredAt,
    bool IsRead);

public sealed record FollowRequest(AlertFrequency Frequency);
