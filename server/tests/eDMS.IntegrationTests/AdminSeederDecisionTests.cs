using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence.Seeding;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class AdminSeederDecisionTests
{
    private static SeedOptions Configured => new()
    {
        AdminEmail = "admin@edms.local",
        AdminTempPassword = "ChangeMe123!",
    };

    [Fact]
    public void Decide_returns_not_configured_when_credentials_are_missing()
    {
        Assert.Equal(AdminSeedOutcome.NotConfigured, AdminSeeder.Decide(new SeedOptions(), false));
        Assert.Equal(
            AdminSeedOutcome.NotConfigured,
            AdminSeeder.Decide(new SeedOptions { AdminEmail = " ", AdminTempPassword = "x" }, false));
        Assert.Equal(
            AdminSeedOutcome.NotConfigured,
            AdminSeeder.Decide(new SeedOptions { AdminEmail = "admin@edms.local", AdminTempPassword = "" }, false));
    }

    [Fact]
    public void Decide_returns_already_seeded_when_users_exist()
    {
        Assert.Equal(AdminSeedOutcome.AlreadySeeded, AdminSeeder.Decide(Configured, true));
    }

    [Fact]
    public void Decide_returns_created_on_empty_database_with_configuration()
    {
        Assert.Equal(AdminSeedOutcome.Created, AdminSeeder.Decide(Configured, false));
    }
}
