using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class FolderTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var libraryId = Guid.NewGuid();
        var parentFolderId = Guid.NewGuid();
        var modifiedBy = Guid.NewGuid();
        var modifiedAt = DateTimeOffset.UtcNow.AddMinutes(-3);

        var folder = new Folder
        {
            LibraryId = libraryId,
            ParentFolderId = parentFolderId,
            Name = "Invoices 2026",
            Path = "/Invoices/Invoices 2026",
            ModifiedBy = modifiedBy,
            ModifiedAt = modifiedAt,
        };

        Assert.Equal(libraryId, folder.LibraryId);
        Assert.Equal(parentFolderId, folder.ParentFolderId);
        Assert.Equal("Invoices 2026", folder.Name);
        Assert.Equal("/Invoices/Invoices 2026", folder.Path);
        Assert.Equal(modifiedBy, folder.ModifiedBy);
        Assert.Equal(modifiedAt, folder.ModifiedAt);
    }

    [Fact]
    public void New_folder_has_safe_defaults()
    {
        var folder = new Folder();

        Assert.Equal(Guid.Empty, folder.LibraryId);
        Assert.Equal(string.Empty, folder.Name);
        Assert.Equal(string.Empty, folder.Path);
        Assert.Null(folder.ParentFolderId);
        Assert.Null(folder.ModifiedBy);
        Assert.Null(folder.ModifiedAt);
    }

    [Fact]
    public void Folder_soft_delete_lifecycle()
    {
        var folder = new Folder();
        var userId = Guid.NewGuid();
        var deletedAt = DateTimeOffset.UtcNow;

        folder.MarkDeleted(userId, deletedAt);
        Assert.True(folder.IsDeleted);
        Assert.Equal(userId, folder.DeletedBy);
        Assert.Equal(deletedAt, folder.DeletedAt);

        folder.Restore();
        Assert.False(folder.IsDeleted);
        Assert.Null(folder.DeletedAt);
        Assert.Null(folder.DeletedBy);
    }
}
