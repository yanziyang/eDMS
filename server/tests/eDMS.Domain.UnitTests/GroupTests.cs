using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class GroupTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var siteId = Guid.NewGuid();
        var group = new Group
        {
            Name = "Finance Department",
            Description = "All members of the finance department",
            IsSystem = true,
            SiteId = siteId,
        };

        Assert.Equal("Finance Department", group.Name);
        Assert.Equal("All members of the finance department", group.Description);
        Assert.True(group.IsSystem);
        Assert.Equal(siteId, group.SiteId);
    }

    [Fact]
    public void New_group_has_safe_defaults()
    {
        var group = new Group();

        Assert.Equal(string.Empty, group.Name);
        Assert.Null(group.Description);
        Assert.False(group.IsSystem);
        Assert.Null(group.SiteId);
    }

    [Fact]
    public void Creator_is_recorded_via_SetCreator()
    {
        var group = new Group();
        var userId = Guid.NewGuid();

        group.SetCreator(userId);

        Assert.Equal(userId, group.CreatedBy);
        Assert.NotEqual(default, group.CreatedAt);
    }
}
