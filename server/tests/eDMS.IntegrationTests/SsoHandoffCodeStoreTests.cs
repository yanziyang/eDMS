using eDMS.Domain;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class SsoHandoffCodeStoreTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly SsoHandoffCodeStore _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public SsoHandoffCodeStoreTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSnakeCaseNamingConvention()
            .UseSqlite(_connection)
            .Options);
        _db.Database.EnsureCreated();
        _db.Users.Add(new ApplicationUser
        {
            Id = _userId,
            UserName = "sso-user@edms.test",
            Email = "sso-user@edms.test",
            DisplayName = "SSO User",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        _db.SaveChanges();
        _sut = new SsoHandoffCodeStore(_db, TimeProvider.System);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Issue_persists_only_a_hash_and_consume_is_single_use()
    {
        var code = await _sut.IssueAsync(_userId);
        var stored = Assert.Single(_db.SsoHandoffCodes);

        Assert.NotEqual(code, stored.CodeHash);
        Assert.Equal(64, stored.CodeHash.Length);
        Assert.Null(stored.ConsumedAt);

        Assert.Equal(_userId, await _sut.ConsumeAsync(code));
        Assert.Null(await _sut.ConsumeAsync(code));
        await _db.Entry(stored).ReloadAsync();
        Assert.NotNull(stored.ConsumedAt);
    }

    [Fact]
    public async Task Expired_code_cannot_be_consumed()
    {
        var code = await _sut.IssueAsync(_userId);
        var stored = await _db.SsoHandoffCodes.SingleAsync();
        stored.ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1);
        await _db.SaveChangesAsync();

        Assert.Null(await _sut.ConsumeAsync(code));
        Assert.Null((await _db.SsoHandoffCodes.SingleAsync()).ConsumedAt);
    }
}
