using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace eDMS.IntegrationTests;

/// <summary>
/// Test host on a real relational provider (SQLite file DB) so integration tests
/// exercise the production SQL paths — including the permission-hierarchy recursive
/// CTE — instead of the EF InMemory provider, which has no raw-SQL support.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<eDMS.Api.Program>
{
    private readonly string _dbPath = Path.Combine(
        Path.GetTempPath(), $"edms-api-tests-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Keep uploads out of the working directory: each test host gets its own
            // temp storage root so parallel test classes never collide.
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:RootPath"] = Path.Combine(
                    Path.GetTempPath(), "edms-test-storage", Guid.NewGuid().ToString("N")),
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsExtension>();
            services.RemoveAll<IDatabaseProvider>();
            services.AddDbContext<AppDbContext>(options =>
                options
                    .UseSnakeCaseNamingConvention()
                    .UseSqlite(
                        $"Data Source={_dbPath}",
                        sqlite => sqlite.MigrationsAssembly("eDMS.Infrastructure.Migrations.Sqlite")));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            SqliteConnection.ClearAllPools();
            File.Delete(_dbPath);
        }
    }
}
