using eDMS.Domain.Common;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class SoftDeletableEntityTests
{
    private sealed class SoftDeletableTestEntity : SoftDeletableEntity
    {
    }

    [Fact]
    public void New_entity_is_not_deleted()
    {
        var entity = new SoftDeletableTestEntity();

        Assert.False(entity.IsDeleted);
        Assert.Null(entity.DeletedAt);
        Assert.Null(entity.DeletedBy);
    }

    [Fact]
    public void MarkDeleted_records_the_actor_and_timestamp()
    {
        var entity = new SoftDeletableTestEntity();
        var userId = Guid.NewGuid();
        var deletedAt = new DateTimeOffset(2026, 2, 14, 9, 30, 0, TimeSpan.Zero);

        entity.MarkDeleted(userId, deletedAt);

        Assert.True(entity.IsDeleted);
        Assert.Equal(deletedAt, entity.DeletedAt);
        Assert.Equal(userId, entity.DeletedBy);
    }

    [Fact]
    public void MarkDeleted_is_idempotent_while_already_deleted()
    {
        var entity = new SoftDeletableTestEntity();
        var firstUser = Guid.NewGuid();
        var firstAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        entity.MarkDeleted(firstUser, firstAt);

        entity.MarkDeleted(Guid.NewGuid(), firstAt.AddDays(10));

        Assert.True(entity.IsDeleted);
        Assert.Equal(firstUser, entity.DeletedBy);
        Assert.Equal(firstAt, entity.DeletedAt);
    }

    [Fact]
    public void Restore_clears_deletion_metadata()
    {
        var entity = new SoftDeletableTestEntity();
        entity.MarkDeleted(Guid.NewGuid(), DateTimeOffset.UtcNow);

        entity.Restore();

        Assert.False(entity.IsDeleted);
        Assert.Null(entity.DeletedAt);
        Assert.Null(entity.DeletedBy);
    }

    [Fact]
    public void Restored_entity_can_be_marked_deleted_again_with_fresh_metadata()
    {
        var entity = new SoftDeletableTestEntity();
        entity.MarkDeleted(Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-5));
        entity.Restore();

        var secondUser = Guid.NewGuid();
        var secondAt = DateTimeOffset.UtcNow;
        entity.MarkDeleted(secondUser, secondAt);

        Assert.True(entity.IsDeleted);
        Assert.Equal(secondUser, entity.DeletedBy);
        Assert.Equal(secondAt, entity.DeletedAt);
    }

    [Fact]
    public void Soft_deletable_entity_also_supports_auditing()
    {
        var entity = new SoftDeletableTestEntity();
        var userId = Guid.NewGuid();

        entity.SetCreator(userId);

        Assert.Equal(userId, entity.CreatedBy);
        Assert.NotEqual(default, entity.CreatedAt);
    }
}
