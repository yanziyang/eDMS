using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Admin;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class UserManagementAndAdminServiceTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly AppDbContext _db;

    public UserManagementAndAdminServiceTests()
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
        services.AddSingleton<ITokenService, FakeTokenService>();
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<AppDbContext>();
    }

    public void Dispose() => _provider.Dispose();

    private UserManagementService Service() =>
        new(
            _provider.GetRequiredService<UserManager<ApplicationUser>>(),
            _provider.GetRequiredService<ITokenService>());

    [Fact]
    public async Task ListAsync_filters_by_search()
    {
        var service = Service();
        await service.CreateAsync("alice@edms.test", "Alice", "Password1!", false, default);
        await service.CreateAsync("bob@edms.test", "Bob", "Password1!", false, default);

        var all = await service.ListAsync(null, default);
        Assert.Equal(2, all.Count);

        var filtered = await service.ListAsync("bob", default);
        Assert.Single(filtered);
        Assert.Equal("Bob", filtered[0].DisplayName);
    }

    [Fact]
    public async Task CreateAsync_rejects_duplicate_email()
    {
        var service = Service();
        await service.CreateAsync("dup@edms.test", "One", "Password1!", false, default);

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateAsync("dup@edms.test", "Two", "Password1!", false, default));
    }

    [Fact]
    public async Task UpdateAsync_updates_and_404s_for_unknown()
    {
        var service = Service();
        var userId = await service.CreateAsync("user@edms.test", "Before", "Password1!", false, default);

        await service.UpdateAsync(userId, "After", true, default);

        var users = await service.ListAsync(null, default);
        var updated = users.Single(user => user.Id == userId);
        Assert.Equal("After", updated.DisplayName);
        Assert.True(updated.IsSystemAdmin);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateAsync(Guid.NewGuid(), "X", false, default));
    }

    [Fact]
    public async Task SetActiveAsync_deactivates_and_revokes_tokens()
    {
        var service = Service();
        var userId = await service.CreateAsync("user@edms.test", "U", "Password1!", false, default);

        await service.SetActiveAsync(userId, false, default);

        var users = await service.ListAsync(null, default);
        Assert.False(users.Single(user => user.Id == userId).IsActive);
        Assert.Contains(userId, FakeTokenService.RevokedUsers);

        await service.SetActiveAsync(userId, true, default);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SetActiveAsync(Guid.NewGuid(), false, default));
    }

    [Fact]
    public async Task AdminService_audit_log_storage_report_and_settings()
    {
        var site = new Site { Name = "Site", UrlSlug = "site" };
        site.SetCreator(Guid.NewGuid());
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(Guid.NewGuid());
        var document = new Document { LibraryId = library.Id, Name = "doc.txt", ContentType = "text/plain" };
        document.SetCreator(Guid.NewGuid());
        var version = new DocumentVersion
        {
            DocumentId = document.Id,
            VersionMajor = 1,
            SizeBytes = 42,
            Checksum = "c",
        };
        version.SetCreator(Guid.NewGuid());
        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Documents.Add(document);
        _db.DocumentVersions.Add(version);
        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            Timestamp = DateTimeOffset.UtcNow,
            UserId = Guid.NewGuid(),
            Action = AuditAction.Login,
            ObjectType = ObjectType.User,
            ObjectId = Guid.NewGuid(),
            ObjectName = "someone",
            SiteId = site.Id,
        });
        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            Timestamp = DateTimeOffset.UtcNow,
            UserId = Guid.NewGuid(),
            Action = AuditAction.Login,
            ObjectType = ObjectType.User,
            ObjectId = Guid.NewGuid(),
            ObjectName = "global",
        });
        await _db.SaveChangesAsync();

        var admin = new AdminService(
            _db,
            Options.Create(new StorageOptions { MaxUploadSizeBytes = 123 }),
            Options.Create(new RecycleBinOptions { RetentionDays = 45 }),
            Options.Create(new JwtOptions { AccessTokenLifetimeMinutes = 15, RefreshTokenLifetimeDays = 14 }));

        var siteLog = await admin.ListAuditLogAsync(site.Id, default);
        Assert.Single(siteLog);
        Assert.Equal("someone", siteLog[0].ObjectName);

        var report = await admin.GetStorageReportAsync(default);
        var row = report.Single(item => item.SiteId == site.Id);
        Assert.Equal(42, row.UsedBytes);

        var settings = await admin.GetSettingsAsync(default);
        Assert.Equal(123, settings.MaxUploadSizeBytes);
        Assert.Equal(45, settings.RecycleBinRetentionDays);
        Assert.Equal(15, settings.AccessTokenLifetimeMinutes);
        Assert.Equal(14, settings.RefreshTokenLifetimeDays);
    }

    private sealed class FakeTokenService : ITokenService
    {
        public static readonly List<Guid> RevokedUsers = [];

        public Task<TokenPair> IssueTokenPairAsync(ApplicationUser user, string? ipAddress, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TokenPair("a", "b", DateTimeOffset.UtcNow.AddDays(1)));

        public Task<RefreshTokenRotationResult> RotateAsync(string refreshToken, string? ipAddress, CancellationToken cancellationToken = default) =>
            Task.FromResult(new RefreshTokenRotationResult(RefreshTokenRotationStatus.Invalid, null));

        public Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            RevokedUsers.Add(userId);
            return Task.CompletedTask;
        }
    }
}
