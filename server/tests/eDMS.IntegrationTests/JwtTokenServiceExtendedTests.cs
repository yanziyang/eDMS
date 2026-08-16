using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class JwtTokenServiceExtendedTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly JwtTokenService _sut;
    private readonly ApplicationUser _user;
    private readonly ApplicationUser _inactiveUser;

    public JwtTokenServiceExtendedTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new AppDbContext(options);
        _user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "active@edms.local",
            Email = "active@edms.local",
            DisplayName = "Active",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _inactiveUser = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "inactive@edms.local",
            Email = "inactive@edms.local",
            DisplayName = "Inactive",
            IsActive = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Users.AddRange(_user, _inactiveUser);
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
    public async Task Rotate_rejects_inactive_user()
    {
        var pair = await _sut.IssueTokenPairAsync(_inactiveUser, null);

        var result = await _sut.RotateAsync(pair.RefreshToken, null);

        Assert.Equal(RefreshTokenRotationStatus.Invalid, result.Status);
    }

    [Fact]
    public async Task Rotate_rejects_missing_user()
    {
        // Issue writes only the refresh token; the user itself is never persisted.
        var ghost = new ApplicationUser { Id = Guid.NewGuid(), UserName = "ghost", Email = "ghost@x" };
        var pair = await _sut.IssueTokenPairAsync(ghost, null);

        var result = await _sut.RotateAsync(pair.RefreshToken, null);

        Assert.Equal(RefreshTokenRotationStatus.Invalid, result.Status);
    }

    [Fact]
    public async Task Revoke_marks_active_token_and_ignores_unknown()
    {
        var pair = await _sut.IssueTokenPairAsync(_user, null);

        await _sut.RevokeAsync(pair.RefreshToken, default);
        Assert.NotNull(_db.RefreshTokens.Single().RevokedAt);

        await _sut.RevokeAsync("unknown-token", default);
        await _sut.RevokeAsync(pair.RefreshToken, default);
    }

    [Fact]
    public async Task RevokeAllForUser_revokes_active_tokens_and_tolerates_none()
    {
        await _sut.IssueTokenPairAsync(_user, null);
        await _sut.IssueTokenPairAsync(_user, null);

        await _sut.RevokeAllForUserAsync(_user.Id, default);
        Assert.All(_db.RefreshTokens, token => Assert.NotNull(token.RevokedAt));

        await _sut.RevokeAllForUserAsync(Guid.NewGuid(), default);
    }
}