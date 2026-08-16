using System.Net;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.IntegrationTests;

/// <summary>
/// Boots the real API host with the SQLite provider (ADR-8) — the local-development
/// default — against a temp-file database, proving the SQLite migration set, the
/// DateTimeOffset converters, and the administrator seed all work end to end.
/// </summary>
public sealed class SqliteApiFactory(string dbPath) : WebApplicationFactory<eDMS.Api.Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["ConnectionStrings:Default"] = $"Data Source={dbPath}",
                ["Seed:AdminEmail"] = "admin@edms.test",
                ["Seed:AdminTempPassword"] = "ChangeMe123!",
            });
        });
    }
}

public sealed class SqliteProviderTests
{
    [Fact]
    public async Task Api_boots_on_sqlite_applies_migrations_and_seeds_administrator()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"edms-sqlite-{Guid.NewGuid():N}.db");
        try
        {
            using var factory = new SqliteApiFactory(dbPath);
            using var client = factory.CreateClient();

            var health = await client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.OK, health.StatusCode);

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
            Assert.NotEmpty(appliedMigrations);

            var users = await db.Users.ToListAsync();
            Assert.Contains(users, user => user.Email == "admin@edms.test" && user.IsSystemAdmin);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(dbPath);
        }
    }
}
