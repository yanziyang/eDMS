using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class SitePermissionTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var siteId = Guid.NewGuid();
        var principalId = Guid.NewGuid();

        var permission = new SitePermission
        {
            SiteId = siteId,
            PrincipalType = PrincipalType.User,
            PrincipalId = principalId,
            Role = SiteRole.Member,
        };

        Assert.Equal(siteId, permission.SiteId);
        Assert.Equal(PrincipalType.User, permission.PrincipalType);
        Assert.Equal(principalId, permission.PrincipalId);
        Assert.Equal(SiteRole.Member, permission.Role);
    }

    [Fact]
    public void New_permission_defaults_to_owner_role()
    {
        var permission = new SitePermission();

        Assert.Equal(SiteRole.Owner, permission.Role);
        Assert.Equal(Guid.Empty, permission.SiteId);
        Assert.Equal(Guid.Empty, permission.PrincipalId);
    }

    [Fact]
    public void Grantor_is_recorded_via_SetCreator()
    {
        var permission = new SitePermission();
        var userId = Guid.NewGuid();

        permission.SetCreator(userId);

        Assert.Equal(userId, permission.CreatedBy);
        Assert.NotEqual(default, permission.CreatedAt);
    }
}
