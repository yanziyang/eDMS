using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class ApplicationUserTests
{
    [Fact]
    public void New_user_has_phase1_safe_defaults()
    {
        var user = new ApplicationUser();

        Assert.True(user.IsActive);
        Assert.False(user.IsSystemAdmin);
        Assert.False(user.MustChangePassword);
        Assert.Equal(AuthProvider.Local, user.AuthProvider);
    }

    [Fact]
    public void Custom_identity_fields_are_settable()
    {
        var user = new ApplicationUser
        {
            DisplayName = "Jordan Reyes",
            IsSystemAdmin = true,
            AuthProvider = AuthProvider.Local,
            ExternalId = null,
        };

        Assert.Equal("Jordan Reyes", user.DisplayName);
        Assert.True(user.IsSystemAdmin);
        Assert.Null(user.ExternalId);
    }

    [Fact]
    public void All_identity_extension_fields_round_trip()
    {
        var createdAt = new DateTimeOffset(2026, 1, 5, 9, 0, 0, TimeSpan.Zero);
        var lastLoginAt = new DateTimeOffset(2026, 2, 10, 16, 30, 0, TimeSpan.Zero);

        var user = new ApplicationUser
        {
            DisplayName = "Sam Chen",
            IsActive = false,
            AuthProvider = AuthProvider.Saml,
            ExternalId = "ext-42",
            AvatarUrl = "https://cdn.example.test/avatars/42.png",
            IsSystemAdmin = true,
            MustChangePassword = true,
            CreatedAt = createdAt,
            LastLoginAt = lastLoginAt,
            UserName = "schen",
            Email = "sam.chen@example.test",
        };

        Assert.Equal("Sam Chen", user.DisplayName);
        Assert.False(user.IsActive);
        Assert.Equal(AuthProvider.Saml, user.AuthProvider);
        Assert.Equal("ext-42", user.ExternalId);
        Assert.Equal("https://cdn.example.test/avatars/42.png", user.AvatarUrl);
        Assert.True(user.IsSystemAdmin);
        Assert.True(user.MustChangePassword);
        Assert.Equal(createdAt, user.CreatedAt);
        Assert.Equal(lastLoginAt, user.LastLoginAt);
        Assert.Equal("schen", user.UserName);
        Assert.Equal("sam.chen@example.test", user.Email);
    }

    [Fact]
    public void Must_change_password_flag_round_trips()
    {
        var user = new ApplicationUser { MustChangePassword = true };

        Assert.True(user.MustChangePassword);

        user.MustChangePassword = false;

        Assert.False(user.MustChangePassword);
    }

    public static IEnumerable<object[]> AuthProviders()
    {
        yield return [AuthProvider.Local];
        yield return [AuthProvider.Saml];
        yield return [AuthProvider.Oidc];
    }

    [Theory]
    [MemberData(nameof(AuthProviders))]
    public void Auth_provider_round_trips_on_the_user(AuthProvider provider)
    {
        var user = new ApplicationUser { AuthProvider = provider };

        Assert.Equal(provider, user.AuthProvider);
    }

    [Fact]
    public void Last_login_at_is_nullable_and_can_be_cleared()
    {
        var user = new ApplicationUser { LastLoginAt = DateTimeOffset.UtcNow };

        user.LastLoginAt = null;

        Assert.Null(user.LastLoginAt);
    }
}
