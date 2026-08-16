using eDMS.Domain;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class AdminSeederExecutionTests : IDisposable
{
    private readonly ServiceProvider _provider;

    public AdminSeederExecutionTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 6;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireDigit = false;
        }).AddEntityFrameworkStores<AppDbContext>();
        _provider = services.BuildServiceProvider();
    }

    public void Dispose() => _provider.Dispose();

    [Fact]
    public async Task SeedAsync_creates_admin_with_forced_password_reset()
    {
        var outcome = await Seeder("admin@edms.local", "ChangeMe123!").SeedAsync();

        Assert.Equal(AdminSeedOutcome.Created, outcome);
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = await userManager.FindByEmailAsync("admin@edms.local");
        Assert.NotNull(admin);
        Assert.True(admin.IsSystemAdmin);
        Assert.True(admin.MustChangePassword);
        Assert.Equal("System Administrator", admin.DisplayName);
    }

    [Fact]
    public async Task SeedAsync_skips_when_not_configured()
    {
        var outcome = await Seeder("", "").SeedAsync();

        Assert.Equal(AdminSeedOutcome.NotConfigured, outcome);
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.Empty(userManager.Users);
    }

    [Fact]
    public async Task SeedAsync_skips_when_users_exist()
    {
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        await userManager.CreateAsync(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "existing@edms.local",
            Email = "existing@edms.local",
            DisplayName = "Existing",
            CreatedAt = DateTimeOffset.UtcNow,
        }, "Password1!");

        var outcome = await Seeder("admin@edms.local", "ChangeMe123!").SeedAsync();

        Assert.Equal(AdminSeedOutcome.AlreadySeeded, outcome);
        Assert.Null(await userManager.FindByEmailAsync("admin@edms.local"));
    }

    [Fact]
    public async Task SeedAsync_throws_when_password_policy_rejects_temp_password()
    {
        var seeder = Seeder("admin@edms.local", "x");

        await Assert.ThrowsAsync<InvalidOperationException>(() => seeder.SeedAsync());
    }

    private AdminSeeder Seeder(string email, string password) =>
        new(
            _provider.GetRequiredService<UserManager<ApplicationUser>>(),
            Options.Create(new SeedOptions { AdminEmail = email, AdminTempPassword = password }),
            NullLogger<AdminSeeder>.Instance);
}
