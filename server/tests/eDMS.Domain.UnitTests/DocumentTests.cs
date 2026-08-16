using eDMS.Domain;
using eDMS.Domain.Common;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class DocumentTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var libraryId = Guid.NewGuid();
        var folderId = Guid.NewGuid();
        var currentVersionId = Guid.NewGuid();
        var checkedOutBy = Guid.NewGuid();
        var checkedOutAt = DateTimeOffset.UtcNow.AddMinutes(-10);
        var modifiedBy = Guid.NewGuid();
        var modifiedAt = DateTimeOffset.UtcNow.AddMinutes(-5);

        var document = new Document
        {
            LibraryId = libraryId,
            FolderId = folderId,
            Name = "invoice-2026-01.pdf",
            Title = "January invoice",
            Description = "Scanned invoice for January 2026",
            ContentType = "application/pdf",
            CurrentVersionId = currentVersionId,
            CheckedOutBy = checkedOutBy,
            CheckedOutAt = checkedOutAt,
            ModifiedBy = modifiedBy,
            ModifiedAt = modifiedAt,
        };

        Assert.Equal(libraryId, document.LibraryId);
        Assert.Equal(folderId, document.FolderId);
        Assert.Equal("invoice-2026-01.pdf", document.Name);
        Assert.Equal("January invoice", document.Title);
        Assert.Equal("Scanned invoice for January 2026", document.Description);
        Assert.Equal("application/pdf", document.ContentType);
        Assert.Equal(currentVersionId, document.CurrentVersionId);
        Assert.Equal(checkedOutBy, document.CheckedOutBy);
        Assert.Equal(checkedOutAt, document.CheckedOutAt);
        Assert.Equal(modifiedBy, document.ModifiedBy);
        Assert.Equal(modifiedAt, document.ModifiedAt);
    }

    [Fact]
    public void New_document_has_safe_defaults()
    {
        var document = new Document();

        Assert.Equal(string.Empty, document.Name);
        Assert.Equal(string.Empty, document.ContentType);
        Assert.Equal(Guid.Empty, document.LibraryId);
        Assert.Null(document.FolderId);
        Assert.Null(document.Title);
        Assert.Null(document.Description);
        Assert.Null(document.CurrentVersionId);
        Assert.Null(document.CheckedOutBy);
        Assert.Null(document.CheckedOutAt);
        Assert.Null(document.ModifiedBy);
        Assert.Null(document.ModifiedAt);
    }

    [Fact]
    public void Optional_properties_can_be_reset_to_null()
    {
        var document = new Document
        {
            FolderId = Guid.NewGuid(),
            Title = "Title",
            Description = "Description",
            CurrentVersionId = Guid.NewGuid(),
            CheckedOutBy = Guid.NewGuid(),
            CheckedOutAt = DateTimeOffset.UtcNow,
            ModifiedBy = Guid.NewGuid(),
            ModifiedAt = DateTimeOffset.UtcNow,
        };

        document.FolderId = null;
        document.Title = null;
        document.Description = null;
        document.CurrentVersionId = null;
        document.CheckedOutBy = null;
        document.CheckedOutAt = null;
        document.ModifiedBy = null;
        document.ModifiedAt = null;

        Assert.Null(document.FolderId);
        Assert.Null(document.Title);
        Assert.Null(document.Description);
        Assert.Null(document.CurrentVersionId);
        Assert.Null(document.CheckedOutBy);
        Assert.Null(document.CheckedOutAt);
        Assert.Null(document.ModifiedBy);
        Assert.Null(document.ModifiedAt);
    }

    [Fact]
    public void Document_soft_delete_lifecycle()
    {
        var document = new Document();
        var userId = Guid.NewGuid();
        var deletedAt = DateTimeOffset.UtcNow;

        document.MarkDeleted(userId, deletedAt);
        Assert.True(document.IsDeleted);
        Assert.Equal(userId, document.DeletedBy);
        Assert.Equal(deletedAt, document.DeletedAt);

        document.Restore();
        Assert.False(document.IsDeleted);
        Assert.Null(document.DeletedAt);
        Assert.Null(document.DeletedBy);
    }
}
