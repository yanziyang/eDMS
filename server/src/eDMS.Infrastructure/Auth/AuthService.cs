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
    private readonly IEmailSender _emailSender;
    private readonly JwtOptions _jwtOptions;
    private readonly ClientOptions _clientOptions;
    private readonly ISsoHandoffCodeStore? _ssoHandoffCodeStore;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ITokenService tokenService,
        IAuditLogger auditLogger,
        ICurrentUser currentUser,
        IEmailSender emailSender,
        IOptions<ClientOptions> clientOptions,
        IOptions<JwtOptions> jwtOptions,
        ISsoHandoffCodeStore? ssoHandoffCodeStore = null)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _auditLogger = auditLogger;
        _currentUser = currentUser;
        _emailSender = emailSender;
        _jwtOptions = jwtOptions.Value;
        _clientOptions = clientOptions.Value;
        _ssoHandoffCodeStore = ssoHandoffCodeStore;
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

        return await CompleteAuthenticationAsync(user, ipAddress, cancellationToken);
    }

    public async Task<AuthResult?> CompleteSsoExchangeAsync(
        string code,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        if (_ssoHandoffCodeStore is null)
        {
            return null;
        }

        var userId = await _ssoHandoffCodeStore.ConsumeAsync(code, cancellationToken);
        if (userId is null)
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(userId.Value.ToString());
        return user is null || !user.IsActive
            ? null
            : await CompleteAuthenticationAsync(user, ipAddress, cancellationToken);
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

    public async Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null || !user.IsActive)
        {
            return;
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var link = $"{_clientOptions.BaseUrl.TrimEnd('/')}/reset-password"
            + $"?email={Uri.EscapeDataString(user.Email ?? string.Empty)}"
            + $"&token={Uri.EscapeDataString(token)}";

        var body = $"""
            <p>A password reset was requested for your eDMS account.</p>
            <p><a href="{link}">Reset your password</a></p>
            <p>This link expires in one hour and can only be used once.</p>
            """;

        await _emailSender.SendAsync(user.Email!, "Reset your eDMS password", body, cancellationToken);
    }

    public async Task<bool> ResetPasswordAsync(
        string email,
        string token,
        string newPassword,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null || !user.IsActive)
        {
            return false;
        }

        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (result.Succeeded)
        {
            user.MustChangePassword = false;
            await _userManager.UpdateAsync(user);
        }

        return result.Succeeded;
    }

    private static CurrentUserDto ToCurrentUser(ApplicationUser user) =>
        new(
            user.Id,
            user.Email ?? string.Empty,
            user.DisplayName,
            user.IsSystemAdmin,
            // Site memberships are populated in M2 once the permission model exists.
            Array.Empty<SiteMembershipDto>());

    private async Task<AuthResult> CompleteAuthenticationAsync(
        ApplicationUser user,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _userManager.UpdateAsync(user);

        var tokens = await _tokenService.IssueTokenPairAsync(user, ipAddress, cancellationToken);
        await _auditLogger.LogAuthAsync(
            user.Id,
            AuditAction.Login,
            user.Email ?? user.UserName ?? string.Empty,
            cancellationToken);
        return new AuthResult(ToCurrentUser(user), tokens, _jwtOptions.AccessTokenLifetimeMinutes * 60);
    }
}
