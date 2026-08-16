using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class ItemPermissionTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var objectId = Guid.NewGuid();
        var principalId = Guid.NewGuid();
        var grantedBy = Guid.NewGuid();
        var grantedAt = new DateTimeOffset(2026, 2, 20, 14, 0, 0, TimeSpan.Zero);

        var permission = new ItemPermission
        {
            ObjectType = ObjectType.Document,
            ObjectId = objectId,
            PrincipalType = PrincipalType.Group,
            PrincipalId = principalId,
            Level = PermissionLevel.Contribute,
            GrantedBy = grantedBy,
            GrantedAt = grantedAt,
        };

        Assert.Equal(ObjectType.Document, permission.ObjectType);
        Assert.Equal(objectId, permission.ObjectId);
        Assert.Equal(PrincipalType.Group, permission.PrincipalType);
        Assert.Equal(principalId, permission.PrincipalId);
        Assert.Equal(PermissionLevel.Contribute, permission.Level);
        Assert.Equal(grantedBy, permission.GrantedBy);
        Assert.Equal(grantedAt, permission.GrantedAt);
    }

    [Fact]
    public void Granted_at_defaults_to_now()
    {
        var before = DateTimeOffset.UtcNow;
        var permission = new ItemPermission();
        var after = DateTimeOffset.UtcNow;

        Assert.InRange(permission.GrantedAt, before, after);
    }

    [Fact]
    public void Grantor_is_recorded_via_SetCreator()
    {
        var permission = new ItemPermission();
        var userId = Guid.NewGuid();

        permission.SetCreator(userId);

        Assert.Equal(userId, permission.CreatedBy);
        Assert.NotEqual(default, permission.CreatedAt);
    }
}
