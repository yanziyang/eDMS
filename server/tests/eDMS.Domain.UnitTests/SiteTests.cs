using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class SiteTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var site = new Site
        {
            Name = "Marketing Hub",
            Description = "Campaigns and brand assets",
            UrlSlug = "marketing",
            StorageQuotaBytes = 107_374_182_400,
            StorageUsedBytes = 2_147_483_648,
        };

        Assert.Equal("Marketing Hub", site.Name);
        Assert.Equal("Campaigns and brand assets", site.Description);
        Assert.Equal("marketing", site.UrlSlug);
        Assert.Equal(107_374_182_400, site.StorageQuotaBytes);
        Assert.Equal(2_147_483_648, site.StorageUsedBytes);
    }

    [Fact]
    public void New_site_has_safe_defaults()
    {
        var site = new Site();

        Assert.Equal(string.Empty, site.Name);
        Assert.Equal(string.Empty, site.UrlSlug);
        Assert.Null(site.Description);
        Assert.Null(site.StorageQuotaBytes);
        Assert.Equal(0, site.StorageUsedBytes);
    }

    [Fact]
    public void Site_soft_delete_lifecycle()
    {
        var site = new Site();
        var userId = Guid.NewGuid();
        var deletedAt = DateTimeOffset.UtcNow;

        site.MarkDeleted(userId, deletedAt);
        Assert.True(site.IsDeleted);
        Assert.Equal(userId, site.DeletedBy);
        Assert.Equal(deletedAt, site.DeletedAt);

        site.Restore();
        Assert.False(site.IsDeleted);
        Assert.Null(site.DeletedAt);
        Assert.Null(site.DeletedBy);
    }
}
