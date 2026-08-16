using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class LibraryTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var siteId = Guid.NewGuid();
        var library = new Library
        {
            SiteId = siteId,
            Name = "Contracts",
            Description = "Signed customer contracts",
            EnableVersioning = false,
            EnableMinorVersions = true,
            RequireCheckout = true,
        };

        Assert.Equal(siteId, library.SiteId);
        Assert.Equal("Contracts", library.Name);
        Assert.Equal("Signed customer contracts", library.Description);
        Assert.False(library.EnableVersioning);
        Assert.True(library.EnableMinorVersions);
        Assert.True(library.RequireCheckout);
    }

    [Fact]
    public void New_library_has_safe_defaults()
    {
        var library = new Library();

        Assert.Equal(Guid.Empty, library.SiteId);
        Assert.Equal(string.Empty, library.Name);
        Assert.Null(library.Description);
        Assert.True(library.EnableVersioning);
        Assert.False(library.EnableMinorVersions);
        Assert.False(library.RequireCheckout);
    }

    [Fact]
    public void Library_soft_delete_lifecycle()
    {
        var library = new Library();
        var userId = Guid.NewGuid();
        var deletedAt = DateTimeOffset.UtcNow;

        library.MarkDeleted(userId, deletedAt);
        Assert.True(library.IsDeleted);
        Assert.Equal(userId, library.DeletedBy);
        Assert.Equal(deletedAt, library.DeletedAt);

        library.Restore();
        Assert.False(library.IsDeleted);
        Assert.Null(library.DeletedAt);
        Assert.Null(library.DeletedBy);
    }
}
