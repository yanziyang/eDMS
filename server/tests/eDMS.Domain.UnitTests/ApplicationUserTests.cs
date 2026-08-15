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
}
