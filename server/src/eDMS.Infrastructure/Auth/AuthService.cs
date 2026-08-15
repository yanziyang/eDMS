using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly IAuditLogger _auditLogger;
    private readonly ICurrentUser _currentUser;
    private readonly JwtOptions _jwtOptions;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ITokenService tokenService,
        IAuditLogger auditLogger,
        ICurrentUser currentUser,
        IOptions<JwtOptions> jwtOptions)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _auditLogger = auditLogger;
        _currentUser = currentUser;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<AuthResult?> LoginAsync(
        LoginRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !user.IsActive)
        {
            return null;
        }

        var result = await _signInManager.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: true);

        if (!result.Succeeded)
        {
            return null;
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _userManager.UpdateAsync(user);

        var tokens = await _tokenService.IssueTokenPairAsync(user, ipAddress, cancellationToken);
        await _auditLogger.LogAuthAsync(user.Id, AuditAction.Login, user.Email ?? user.UserName ?? string.Empty, cancellationToken);
        return new AuthResult(ToCurrentUser(user), tokens, _jwtOptions.AccessTokenLifetimeMinutes * 60);
    }

    public async Task<RefreshAuthResult> RefreshAsync(
        string refreshToken,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var result = await _tokenService.RotateAsync(refreshToken, ipAddress, cancellationToken);
        return new RefreshAuthResult(
            result.Status,
            result.TokenPair,
            _jwtOptions.AccessTokenLifetimeMinutes * 60);
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        await _tokenService.RevokeAsync(refreshToken, cancellationToken);
        if (_currentUser.UserId is { } userId)
        {
            await _auditLogger.LogAuthAsync(
                userId,
                AuditAction.Logout,
                _currentUser.Email ?? string.Empty,
                cancellationToken);
        }
    }

    public async Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        return user is null || !user.IsActive ? null : ToCurrentUser(user);
    }

    private static CurrentUserDto ToCurrentUser(ApplicationUser user) =>
        new(
            user.Id,
            user.Email ?? string.Empty,
            user.DisplayName,
            user.IsSystemAdmin,
            // Site memberships are populated in M2 once the permission model exists.
            Array.Empty<SiteMembershipDto>());
}
