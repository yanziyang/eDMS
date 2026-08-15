using System.Security.Cryptography;
using System.Text;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class JwtTokenServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly JwtTokenService _sut;
    private readonly ApplicationUser _user;

    public JwtTokenServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new AppDbContext(options);
        _user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "admin@edms.local",
            Email = "admin@edms.local",
            DisplayName = "System Administrator",
            IsSystemAdmin = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Users.Add(_user);
        _db.SaveChanges();

        var jwtOptions = Options.Create(new JwtOptions
        {
            Issuer = "edms",
            Audience = "edms-api",
            AccessTokenLifetimeMinutes = 15,
            RefreshTokenLifetimeDays = 14,
        });

        _sut = new JwtTokenService(
            _db,
            jwtOptions,
            new TokenKeyMaterial(jwtOptions.Value),
            TimeProvider.System);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Issue_stores_only_the_hash()
    {
        var pair = await _sut.IssueTokenPairAsync(_user, "1.2.3.4");

        var stored = Assert.Single(_db.RefreshTokens);
        Assert.NotEqual(pair.RefreshToken, stored.TokenHash);
        Assert.Equal(64, stored.TokenHash.Length);
        Assert.Equal(HashOf(pair.RefreshToken), stored.TokenHash);
        Assert.False(string.IsNullOrWhiteSpace(pair.AccessToken));
    }

    [Fact]
    public async Task Rotate_revokes_old_token_and_issues_replacement()
    {
        var first = await _sut.IssueTokenPairAsync(_user, null);

        var result = await _sut.RotateAsync(first.RefreshToken, null);

        Assert.Equal(RefreshTokenRotationStatus.Success, result.Status);
        Assert.NotNull(result.TokenPair);

        var replacement = _db.RefreshTokens.Single(x => x.TokenHash == HashOf(result.TokenPair!.RefreshToken));
        var old = _db.RefreshTokens.Single(x => x.TokenHash == HashOf(first.RefreshToken));

        Assert.NotNull(old.RevokedAt);
        Assert.Equal(replacement.Id, old.ReplacedByTokenId);
    }

    [Fact]
    public async Task Rotate_reuse_revokes_the_whole_chain()
    {
        var first = await _sut.IssueTokenPairAsync(_user, null);
        var second = await _sut.RotateAsync(first.RefreshToken, null);
        Assert.Equal(RefreshTokenRotationStatus.Success, second.Status);

        var reused = await _sut.RotateAsync(first.RefreshToken, null);

        Assert.Equal(RefreshTokenRotationStatus.ReuseDetected, reused.Status);
        Assert.Null(reused.TokenPair);
        Assert.All(_db.RefreshTokens, token => Assert.NotNull(token.RevokedAt));
    }

    [Fact]
    public async Task Rotate_unknown_token_is_invalid()
    {
        var result = await _sut.RotateAsync("unknown-token", null);

        Assert.Equal(RefreshTokenRotationStatus.Invalid, result.Status);
        Assert.Null(result.TokenPair);
    }

    [Fact]
    public async Task Rotate_expired_token_is_invalid()
    {
        var pair = await _sut.IssueTokenPairAsync(_user, null);
        var stored = _db.RefreshTokens.Single();
        stored.ExpiresAt = TimeProvider.System.GetUtcNow().AddDays(-1);
        await _db.SaveChangesAsync();

        var result = await _sut.RotateAsync(pair.RefreshToken, null);

        Assert.Equal(RefreshTokenRotationStatus.Invalid, result.Status);
    }

    private static string HashOf(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
