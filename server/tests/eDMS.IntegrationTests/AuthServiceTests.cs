using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Auditing;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class AuthServiceTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AuthService _sut;

    public AuthServiceTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddAuthentication(options => options.DefaultScheme = IdentityConstants.ApplicationScheme);
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddEntityFrameworkStores<AppDbContext>();

        _provider = services.BuildServiceProvider();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();

        var jwtOptions = Options.Create(new JwtOptions
        {
            AccessTokenLifetimeMinutes = 15,
            RefreshTokenLifetimeDays = 14,
        });

        _sut = new AuthService(
            _userManager,
            _provider.GetRequiredService<SignInManager<ApplicationUser>>(),
            new FakeTokenService(),
            new AuditLogger(_provider.GetRequiredService<AppDbContext>(), new FakeCurrentUser()),
            new FakeCurrentUser(),
            new FakeEmailSender(),
            Options.Create(new ClientOptions { BaseUrl = "http://localhost:5173" }),
            jwtOptions);
    }

    public void Dispose() => _provider.Dispose();

    [Fact]
    public async Task Login_with_valid_credentials_returns_a_token_pair()
    {
        await CreateUserAsync("admin@edms.local", "Password1!");

        var result = await _sut.LoginAsync(new LoginRequest("admin@edms.local", "Password1!"), "1.2.3.4", default);

        Assert.NotNull(result);
        Assert.Equal("admin@edms.local", result!.User.Email);
        Assert.Equal(15 * 60, result.ExpiresInSeconds);
        Assert.False(string.IsNullOrWhiteSpace(result.Tokens.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(result.Tokens.RefreshToken));
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_null()
    {
        await CreateUserAsync("admin@edms.local", "Password1!");

        var result = await _sut.LoginAsync(new LoginRequest("admin@edms.local", "wrong"), null, default);

        Assert.Null(result);
    }

    [Fact]
    public async Task Login_with_unknown_email_returns_null()
    {
        var result = await _sut.LoginAsync(new LoginRequest("nobody@edms.local", "Password1!"), null, default);

        Assert.Null(result);
    }

    [Fact]
    public async Task Login_with_inactive_user_returns_null()
    {
        await CreateUserAsync("admin@edms.local", "Password1!", isActive: false);

        var result = await _sut.LoginAsync(new LoginRequest("admin@edms.local", "Password1!"), null, default);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetCurrentUser_maps_identity_fields()
    {
        var created = await CreateUserAsync("admin@edms.local", "Password1!", isSystemAdmin: true);

        var result = await _sut.GetCurrentUserAsync(created.Id, default);

        Assert.NotNull(result);
        Assert.True(result!.IsSystemAdmin);
        Assert.Equal("admin@edms.local", result.Email);
        Assert.Empty(result.SiteMemberships);
    }

    [Fact]
    public async Task Five_failed_logins_lock_the_account()
    {
        await CreateUserAsync("admin@edms.local", "Password1!");

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failed = await _sut.LoginAsync(new LoginRequest("admin@edms.local", "wrong"), null, default);
            Assert.Null(failed);
        }

        var user = await _userManager.FindByEmailAsync("admin@edms.local");
        Assert.NotNull(user);
        Assert.True(await _userManager.IsLockedOutAsync(user!));

        // Even the correct password must be rejected while locked out.
        var lockedOut = await _sut.LoginAsync(new LoginRequest("admin@edms.local", "Password1!"), null, default);
        Assert.Null(lockedOut);
    }

    [Fact]
    public async Task Password_reset_flow_works_with_a_generated_token()
    {
        await CreateUserAsync("admin@edms.local", "Password1!");

        await _sut.RequestPasswordResetAsync("admin@edms.local", default);

        var user = await _userManager.FindByEmailAsync("admin@edms.local");
        var token = await _userManager.GeneratePasswordResetTokenAsync(user!);

        var success = await _sut.ResetPasswordAsync("admin@edms.local", token, "NewPassword1!", default);

        Assert.True(success);
        var check = await _signInManagerForCheck(user!, "NewPassword1!");
        Assert.True(check);
    }

    [Fact]
    public async Task Password_reset_with_wrong_token_fails()
    {
        await CreateUserAsync("admin@edms.local", "Password1!");

        var success = await _sut.ResetPasswordAsync("admin@edms.local", "bogus-token", "NewPassword1!", default);

        Assert.False(success);
    }

    private async Task<bool> _signInManagerForCheck(ApplicationUser user, string password)
    {
        var manager = _provider.GetRequiredService<SignInManager<ApplicationUser>>();
        var result = await manager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: false);
        return result.Succeeded;
    }

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string password,
        bool isActive = true,
        bool isSystemAdmin = false)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = email,
            EmailConfirmed = true,
            IsActive = isActive,
            IsSystemAdmin = isSystemAdmin,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(e => e.Description)));
        return user;
    }

    private sealed class FakeTokenService : ITokenService
    {
        public Task<TokenPair> IssueTokenPairAsync(
            ApplicationUser user,
            string? ipAddress,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddDays(14)));

        public Task<RefreshTokenRotationResult> RotateAsync(
            string refreshToken,
            string? ipAddress,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new RefreshTokenRotationResult(RefreshTokenRotationStatus.Success, new TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddDays(14))));

        public Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId => Guid.Empty;

        public bool IsSystemAdmin => false;

        public string? Email => null;

        public string? IpAddress => null;
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public Task SendAsync(
            string to,
            string subject,
            string htmlBody,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
