using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class SiteRoleExtensionsTests
{
    public static IEnumerable<object[]> DefinedRoles()
    {
        yield return [SiteRole.Owner, PermissionLevel.FullControl];
        yield return [SiteRole.Member, PermissionLevel.Contribute];
        yield return [SiteRole.Visitor, PermissionLevel.Read];
    }

    [Theory]
    [MemberData(nameof(DefinedRoles))]
    public void Defined_roles_map_to_their_permission_level(SiteRole role, PermissionLevel expected)
    {
        Assert.Equal(expected, role.ToPermissionLevel());
    }

    public static IEnumerable<object[]> UndefinedRoles()
    {
        yield return [(SiteRole)(-1)];
        yield return [(SiteRole)3];
        yield return [(SiteRole)99];
    }

    [Theory]
    [MemberData(nameof(UndefinedRoles))]
    public void Out_of_range_roles_map_to_NoAccess(SiteRole role)
    {
        Assert.Equal(PermissionLevel.NoAccess, role.ToPermissionLevel());
    }

    [Fact]
    public void Default_role_is_owner_with_full_control()
    {
        Assert.Equal(SiteRole.Owner, default(SiteRole));
        Assert.Equal(PermissionLevel.FullControl, default(SiteRole).ToPermissionLevel());
    }
}
