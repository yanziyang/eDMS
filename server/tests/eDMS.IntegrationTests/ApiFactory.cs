using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace eDMS.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<eDMS.Api.Program>
{
    private readonly Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot _root = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsExtension>();
            services.RemoveAll<IDatabaseProvider>();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("edms-tests", _root));
        });
    }
}
