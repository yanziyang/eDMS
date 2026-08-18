using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace eDMS.IntegrationTests;

public sealed class DefaultContentTypeSeederTests : IDisposable
{
    private readonly ServiceProvider _provider;

    public DefaultContentTypeSeederTests()
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
    public async Task SeedAsync_creates_common_org_wide_content_types_and_columns()
    {
        var admin = await CreateAdminAsync();

        var created = await Seeder().SeedAsync();

        Assert.Equal(DefaultContentTypeSeeder.Catalog.Count, created);
        var db = _provider.GetRequiredService<AppDbContext>();
        var contentTypes = await db.ContentTypes
            .Where(contentType => contentType.LibraryId == null)
            .ToListAsync();
        Assert.Equal(DefaultContentTypeSeeder.Catalog.Count, contentTypes.Count);

        foreach (var definition in DefaultContentTypeSeeder.Catalog)
        {
            var contentType = Assert.Single(contentTypes, item => item.Name == definition.Name);
            Assert.Equal(definition.Description, contentType.Description);
            Assert.Equal(admin.Id, contentType.CreatedBy);

            var columns = await db.ColumnDefinitions
                .Where(column => column.ContentTypeId == contentType.Id)
                .ToListAsync();
            Assert.Equal(definition.Columns.Count, columns.Count);
            Assert.All(definition.Columns, definitionColumn =>
            {
                var column = Assert.Single(columns, item => item.Name == definitionColumn.Name);
                Assert.Equal(definitionColumn.DataType, column.DataType);
                Assert.Equal(definitionColumn.IsRequired, column.IsRequired);
            });
        }
    }

    [Fact]
    public async Task SeedAsync_is_idempotent_and_does_not_overwrite_existing_definition()
    {
        await CreateAdminAsync();
        var seeder = Seeder();

        await seeder.SeedAsync();
        var db = _provider.GetRequiredService<AppDbContext>();
        var contract = await db.ContentTypes.SingleAsync(contentType => contentType.Name == "Contract");
        contract.Description = "Custom description";
        await db.SaveChangesAsync();

        var createdOnSecondRun = await seeder.SeedAsync();

        Assert.Equal(0, createdOnSecondRun);
        Assert.Equal(
            "Custom description",
            (await db.ContentTypes.SingleAsync(contentType => contentType.Id == contract.Id)).Description);
        Assert.Equal(
            DefaultContentTypeSeeder.Catalog.Sum(definition => definition.Columns.Count),
            await db.ColumnDefinitions.CountAsync());
    }

    private async Task<ApplicationUser> CreateAdminAsync()
    {
        var admin = new ApplicationUser
        {
            UserName = "admin@edms.local",
            Email = "admin@edms.local",
            DisplayName = "System Administrator",
            EmailConfirmed = true,
            IsActive = true,
            IsSystemAdmin = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var result = await _provider.GetRequiredService<UserManager<ApplicationUser>>()
            .CreateAsync(admin, "ChangeMe123!");
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(error => error.Description)));
        return admin;
    }

    private DefaultContentTypeSeeder Seeder() =>
        new(
            _provider.GetRequiredService<UserManager<ApplicationUser>>(),
            _provider.GetRequiredService<AppDbContext>(),
            NullLogger<DefaultContentTypeSeeder>.Instance);
}
