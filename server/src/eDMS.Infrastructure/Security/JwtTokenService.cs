using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace eDMS.Infrastructure.Security;

/// <summary>
/// RS256 access-token issuance plus rotating opaque refresh tokens with reuse
/// detection, exactly as specified in TDS §5.5.
/// </summary>
public sealed class JwtTokenService : ITokenService
{
    private readonly AppDbContext _db;
    private readonly JwtOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly TokenKeyMaterial _keyMaterial;

    public JwtTokenService(
        AppDbContext db,
        IOptions<JwtOptions> options,
        TokenKeyMaterial keyMaterial,
        TimeProvider timeProvider)
    {
        _db = db;
        _options = options.Value;
        _keyMaterial = keyMaterial;
        _timeProvider = timeProvider;
    }

    public async Task<TokenPair> IssueTokenPairAsync(
        ApplicationUser user,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        var (pair, entity) = CreateTokenPair(user, ipAddress, _timeProvider.GetUtcNow());

        _db.RefreshTokens.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return pair;
    }

    public async Task<RefreshTokenRotationResult> RotateAsync(
        string refreshToken,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        var hash = HashToken(refreshToken);
        var now = _timeProvider.GetUtcNow();

        var token = await _db.RefreshTokens
            .SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);

        if (token is null)
        {
            return new RefreshTokenRotationResult(RefreshTokenRotationStatus.Invalid, null);
        }

        if (token.RevokedAt is not null)
        {
            await RevokeChainForUserAsync(token.UserId, now, cancellationToken);
            return new RefreshTokenRotationResult(RefreshTokenRotationStatus.ReuseDetected, null);
        }

        if (token.ExpiresAt <= now)
        {
            return new RefreshTokenRotationResult(RefreshTokenRotationStatus.Invalid, null);
        }

        var user = await _db.Users.FindAsync([token.UserId], cancellationToken);
        if (user is null || !user.IsActive)
        {
            return new RefreshTokenRotationResult(RefreshTokenRotationStatus.Invalid, null);
        }

        var (pair, replacement) = CreateTokenPair(user, ipAddress, now);

        token.RevokedAt = now;
        token.ReplacedByTokenId = replacement.Id;
        _db.RefreshTokens.Add(replacement);

        await _db.SaveChangesAsync(cancellationToken);

        return new RefreshTokenRotationResult(RefreshTokenRotationStatus.Success, pair);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var hash = HashToken(refreshToken);
        var token = await _db.RefreshTokens
            .SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);

        if (token is not null && token.RevokedAt is null)
        {
            token.RevokedAt = _timeProvider.GetUtcNow();
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var active = await _db.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAt == null)
            .ToListAsync(cancellationToken);

        var now = _timeProvider.GetUtcNow();
        foreach (var token in active)
        {
            token.RevokedAt = now;
        }

        if (active.Count != 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    private (TokenPair Pair, RefreshToken Entity) CreateTokenPair(
        ApplicationUser user,
        string? ipAddress,
        DateTimeOffset now)
    {
        var refreshTokenValue = CreateRefreshTokenValue();
        var expiresAt = now.AddDays(_options.RefreshTokenLifetimeDays);

        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = HashToken(refreshTokenValue),
            ExpiresAt = expiresAt,
            CreatedAt = now,
            CreatedByIp = ipAddress,
        };

        var pair = new TokenPair(CreateAccessToken(user, now), refreshTokenValue, expiresAt);
        return (pair, entity);
    }

    private string CreateAccessToken(ApplicationUser user, DateTimeOffset now)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("is_admin", user.IsSystemAdmin ? "true" : "false", ClaimValueTypes.Boolean),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: now.UtcDateTime.AddMinutes(_options.AccessTokenLifetimeMinutes),
            signingCredentials: new SigningCredentials(_keyMaterial.SigningKey, SecurityAlgorithms.RsaSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string CreateRefreshTokenValue()
    {
        return Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
    }

    private static string HashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task RevokeChainForUserAsync(
        Guid userId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var active = await _db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var item in active)
        {
            item.RevokedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

}
