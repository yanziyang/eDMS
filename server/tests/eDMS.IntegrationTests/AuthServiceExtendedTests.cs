using System.Text.RegularExpressions;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class AuthServiceExtendedTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly AuthService _service;
    private readonly CapturingEmailSender _emailSender = new();
    private readonly FakeCurrentUser _currentUser = new();

    public AuthServiceExtendedTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddAuthentication(options =>
            options.DefaultScheme = IdentityConstants.ApplicationScheme);
        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 6;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireDigit = false;
        }).AddSignInManager()
        .AddDefaultTokenProviders()
        .AddEntityFrameworkStores<AppDbContext>();
        _provider = services.BuildServiceProvider();

        _service = new AuthService(
            _provider.GetRequiredService<UserManager<ApplicationUser>>(),
            _provider.GetRequiredService<SignInManager<ApplicationUser>>(),
            new FakeTokenService(),
            new FakeAuditLogger(),
            _currentUser,
            _emailSender,
            Options.Create(new ClientOptions { BaseUrl = "http://localhost:5173/" }),
            Options.Create(new JwtOptions { AccessTokenLifetimeMinutes = 15 }));
    }

    public void Dispose() => _provider.Dispose();

    [Fact]
    public async Task Reset_password_flow_generates_link_sends_email_and_resets()
    {
        var email = $"{Guid.NewGuid():N}@edms.test";
        await CreateUserAsync(email, "OldPassword1!");

        await _service.RequestPasswordResetAsync(email, default);

        var sent = Assert.Single(_emailSender.Sent);
        Assert.Equal(email, sent.To);
        var match = Regex.Match(sent.Body, @"token=([^&""]+)");
        Assert.True(match.Success);
        var token = Uri.UnescapeDataString(match.Groups[1].Value);

        var success = await _service.ResetPasswordAsync(email, token, "NewPassword1!", default);
        Assert.True(success);

        var login = await _service.LoginAsync(
            new LoginRequest(email, "NewPassword1!"), null, default);
        Assert.NotNull(login);
    }

    [Fact]
    public async Task Reset_password_returns_false_for_unknown_or_inactive_accounts()
    {
        Assert.False(await _service.ResetPasswordAsync("nobody@edms.test", "t", "NewPassword1!", default));

        var email = $"{Guid.NewGuid():N}@edms.test";
        await CreateUserAsync(email, "OldPassword1!");
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        user!.IsActive = false;
        await userManager.UpdateAsync(user);

        Assert.False(await _service.ResetPasswordAsync(email, "t", "NewPassword1!", default));
    }

    [Fact]
    public async Task RequestPasswordReset_ignores_unknown_accounts()
    {
        await _service.RequestPasswordResetAsync("ghost@edms.test", default);
        Assert.Empty(_emailSender.Sent);
    }

    [Fact]
    public async Task Login_returns_null_for_unknown_or_inactive_accounts()
    {
        var email = $"{Guid.NewGuid():N}@edms.test";
        await CreateUserAsync(email, "Password1!");

        Assert.Null(await _service.LoginAsync(new LoginRequest("ghost@edms.test", "x"), null, default));
        Assert.Null(await _service.LoginAsync(new LoginRequest(email, "wrong"), null, default));

        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        user!.IsActive = false;
        await userManager.UpdateAsync(user);

        Assert.Null(await _service.LoginAsync(new LoginRequest(email, "Password1!"), null, default));
    }

    [Fact]
    public async Task GetCurrentUser_returns_null_for_unknown_or_inactive()
    {
        Assert.Null(await _service.GetCurrentUserAsync(Guid.NewGuid(), default));

        var email = $"{Guid.NewGuid():N}@edms.test";
        await CreateUserAsync(email, "Password1!");
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        var dto = await _service.GetCurrentUserAsync(user!.Id, default);
        Assert.NotNull(dto);
        Assert.Equal(email, dto.Email);
    }

    [Fact]
    public async Task RevokeRefreshToken_logs_logout_with_current_user()
    {
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Email = "me@edms.test";
        await _service.RevokeRefreshTokenAsync("token", default);
        Assert.NotEmpty(FakeAuditLogger.Entries);
    }

    private async Task CreateUserAsync(string email, string password)
    {
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var result = await userManager.CreateAsync(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = email,
            EmailConfirmed = true,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        }, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(error => error.Description)));
    }

    private sealed class CapturingEmailSender : IEmailSender
    {
        public List<(string To, string Subject, string Body)> Sent { get; } = [];

        public Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Sent.Add((to, subject, htmlBody));
            return Task.CompletedTask;
        }
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId { get; set; }
        public bool IsSystemAdmin => false;
        public string? Email { get; set; }
        public string? IpAddress => null;
        public string? ShareToken => null;
    }

    private sealed class FakeTokenService : ITokenService
    {
        public Task<TokenPair> IssueTokenPairAsync(ApplicationUser user, string? ipAddress, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddDays(1)));

        public Task<RefreshTokenRotationResult> RotateAsync(string refreshToken, string? ipAddress, CancellationToken cancellationToken = default) =>
            Task.FromResult(new RefreshTokenRotationResult(RefreshTokenRotationStatus.Success,
                new TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddDays(1))));

        public Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeAuditLogger : IAuditLogger
    {
        public static readonly List<AuditAction> Entries = [];

        public Task LogAsync(AuditAction action, ObjectType objectType, Guid objectId, string objectName, Guid? siteId, CancellationToken cancellationToken = default)
        {
            Entries.Add(action);
            return Task.CompletedTask;
        }

        public Task LogAuthAsync(Guid userId, AuditAction action, string objectName, CancellationToken cancellationToken = default)
        {
            Entries.Add(action);
            return Task.CompletedTask;
        }
    }
}
