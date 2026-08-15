using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Security;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class PermissionResolverTests
{
    [Fact]
    public async Task System_administrator_gets_full_control()
    {
        var resolver = new PermissionResolver(new FixedCurrentUser(isSystemAdmin: true));

        var level = await resolver.GetEffectiveLevelAsync(Guid.NewGuid(), ObjectType.Document, Guid.NewGuid());

        Assert.Equal(PermissionLevel.FullControl, level);
    }

    [Fact]
    public async Task Non_administrator_has_no_access_in_stub()
    {
        var resolver = new PermissionResolver(new FixedCurrentUser(isSystemAdmin: false));

        var level = await resolver.GetEffectiveLevelAsync(Guid.NewGuid(), ObjectType.Document, Guid.NewGuid());

        Assert.Equal(PermissionLevel.NoAccess, level);
    }

    private sealed class FixedCurrentUser(bool isSystemAdmin) : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();

        public bool IsSystemAdmin => isSystemAdmin;

        public string? Email => null;

        public string? IpAddress => null;
    }
}
