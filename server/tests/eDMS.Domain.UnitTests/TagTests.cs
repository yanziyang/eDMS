using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class TagTests
{
    [Fact]
    public void Name_round_trips()
    {
        var tag = new Tag { Name = "invoice" };

        Assert.Equal("invoice", tag.Name);
    }

    [Fact]
    public void New_tag_has_empty_name()
    {
        var tag = new Tag();

        Assert.Equal(string.Empty, tag.Name);
    }

    [Fact]
    public void Creator_is_recorded_via_SetCreator()
    {
        var tag = new Tag();
        var userId = Guid.NewGuid();

        tag.SetCreator(userId);

        Assert.Equal(userId, tag.CreatedBy);
        Assert.NotEqual(default, tag.CreatedAt);
    }
}
