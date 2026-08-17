using eDMS.Domain;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.IntegrationTests;

public sealed class JitProvisioningServiceTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JitProvisioningService _sut;

    public JitProvisioningServiceTests()
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
        _db = _provider.GetRequiredService<AppDbContext>();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _sut = new JitProvisioningService(_userManager);
    }

    public void Dispose() => _provider.Dispose();

    [Fact]
    public async Task New_federated_user_is_created_without_site_memberships()
    {
        var email = TestSupport.UniqueEmail();

        var user = await _sut.ProvisionOrLinkAsync(
            AuthProvider.Oidc,
            "oidc-new-user",
            email,
            "New User");

        Assert.NotNull(user);
        Assert.Equal(AuthProvider.Oidc, user.AuthProvider);
        Assert.Equal("oidc-new-user", user.ExternalId);
        Assert.True(user.IsActive);
        Assert.False(user.IsSystemAdmin);
        Assert.Empty(_db.GroupMembers);
        Assert.Empty(_db.SitePermissions);
    }

    [Fact]
    public async Task Existing_local_user_is_linked_in_place_instead_of_duplicated()
    {
        var email = TestSupport.UniqueEmail();
        var local = await CreateUserAsync(email, "Password1!");

        var linked = await _sut.ProvisionOrLinkAsync(
            AuthProvider.Saml,
            "saml-existing-user",
            email.ToUpperInvariant(),
            "Federated Name");

        Assert.NotNull(linked);
        Assert.Equal(local.Id, linked.Id);
        Assert.Equal(AuthProvider.Saml, linked.AuthProvider);
        Assert.Equal("saml-existing-user", linked.ExternalId);
        Assert.Single(_userManager.Users);
    }

    [Fact]
    public async Task Deactivated_matching_user_is_rejected()
    {
        var email = TestSupport.UniqueEmail();
        var user = await CreateUserAsync(email, "Password1!");
        user.IsActive = false;
        await _userManager.UpdateAsync(user);

        var result = await _sut.ProvisionOrLinkAsync(
            AuthProvider.Oidc,
            "oidc-deactivated",
            email,
            "Deactivated");

        Assert.Null(result);
        Assert.Single(_userManager.Users);
    }

    [Fact]
    public async Task External_identity_match_takes_precedence_over_email_linking()
    {
        var externalEmail = TestSupport.UniqueEmail();
        var localEmail = TestSupport.UniqueEmail();
        var externalUser = await CreateUserAsync(externalEmail, "Password1!");
        externalUser.AuthProvider = AuthProvider.Oidc;
        externalUser.ExternalId = "oidc-stable-id";
        await _userManager.UpdateAsync(externalUser);
        await CreateUserAsync(localEmail, "Password1!");

        var result = await _sut.ProvisionOrLinkAsync(
            AuthProvider.Oidc,
            "oidc-stable-id",
            localEmail,
            "Should Not Relink");

        Assert.NotNull(result);
        Assert.Equal(externalUser.Id, result.Id);
        Assert.Equal(2, _userManager.Users.Count());
        Assert.Equal(AuthProvider.Local, (await _userManager.FindByEmailAsync(localEmail))!.AuthProvider);
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string password)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = email,
            EmailConfirmed = true,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var result = await _userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(error => error.Description)));
        return user;
    }
}
