namespace eDMS.Domain;

public sealed class GroupMember
{
    public Guid GroupId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}
