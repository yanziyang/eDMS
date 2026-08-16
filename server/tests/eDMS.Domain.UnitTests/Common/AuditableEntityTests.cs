using eDMS.Domain.Common;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class AuditableEntityTests
{
    private sealed class AuditableTestEntity : AuditableEntity
    {
    }

    [Fact]
    public void New_entity_gets_a_non_empty_version7_id()
    {
        var entity = new AuditableTestEntity();

        Assert.NotEqual(Guid.Empty, entity.Id);
        Assert.Equal(7, entity.Id.Version);
    }

    [Fact]
    public void New_entity_created_at_defaults_to_now()
    {
        var before = DateTimeOffset.UtcNow;
        var entity = new AuditableTestEntity();
        var after = DateTimeOffset.UtcNow;

        Assert.InRange(entity.CreatedAt, before, after);
    }

    [Fact]
    public void New_entity_has_no_creator()
    {
        var entity = new AuditableTestEntity();

        Assert.Equal(Guid.Empty, entity.CreatedBy);
    }

    [Fact]
    public void SetCreator_records_the_user_and_a_fresh_timestamp()
    {
        var entity = new AuditableTestEntity();
        var userId = Guid.NewGuid();
        var before = DateTimeOffset.UtcNow;

        entity.SetCreator(userId);
        var after = DateTimeOffset.UtcNow;

        Assert.Equal(userId, entity.CreatedBy);
        Assert.InRange(entity.CreatedAt, before, after);
    }

    [Fact]
    public void SetCreator_overwrites_a_previous_creator()
    {
        var entity = new AuditableTestEntity();
        entity.SetCreator(Guid.NewGuid());
        var originalCreatedAt = entity.CreatedAt;

        var replacement = Guid.NewGuid();
        entity.SetCreator(replacement);

        Assert.Equal(replacement, entity.CreatedBy);
        Assert.True(entity.CreatedAt >= originalCreatedAt);
    }
}
