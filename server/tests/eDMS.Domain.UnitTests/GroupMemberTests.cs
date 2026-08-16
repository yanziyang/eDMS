using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class GroupMemberTests
{
    [Fact]
    public void Membership_ids_round_trip()
    {
        var groupId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var member = new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
        };

        Assert.Equal(groupId, member.GroupId);
        Assert.Equal(userId, member.UserId);
    }

    [Fact]
    public void Added_at_defaults_to_now()
    {
        var before = DateTimeOffset.UtcNow;
        var member = new GroupMember();
        var after = DateTimeOffset.UtcNow;

        Assert.InRange(member.AddedAt, before, after);
    }

    [Fact]
    public void Added_at_is_settable()
    {
        var addedAt = new DateTimeOffset(2026, 3, 1, 8, 15, 0, TimeSpan.FromHours(1));
        var member = new GroupMember { AddedAt = addedAt };

        Assert.Equal(addedAt, member.AddedAt);
    }
}
