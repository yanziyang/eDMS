using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class DocumentVersionTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var documentId = Guid.NewGuid();
        var version = new DocumentVersion
        {
            DocumentId = documentId,
            VersionMajor = 2,
            VersionMinor = 3,
            StorageKey = "documents/2026/01/invoice-2026-01_v2.3.pdf",
            SizeBytes = 1_048_576,
            Checksum = "d41d8cd98f00b204e9800998ecf8427e",
            Comment = "Added the VAT breakdown page",
            IsMajor = false,
        };

        Assert.Equal(documentId, version.DocumentId);
        Assert.Equal(2, version.VersionMajor);
        Assert.Equal(3, version.VersionMinor);
        Assert.Equal("documents/2026/01/invoice-2026-01_v2.3.pdf", version.StorageKey);
        Assert.Equal(1_048_576, version.SizeBytes);
        Assert.Equal("d41d8cd98f00b204e9800998ecf8427e", version.Checksum);
        Assert.Equal("Added the VAT breakdown page", version.Comment);
        Assert.False(version.IsMajor);
    }

    [Fact]
    public void New_version_has_safe_defaults()
    {
        var version = new DocumentVersion();

        Assert.Equal(Guid.Empty, version.DocumentId);
        Assert.Equal(0, version.VersionMajor);
        Assert.Equal(0, version.VersionMinor);
        Assert.Equal(string.Empty, version.StorageKey);
        Assert.Equal(0, version.SizeBytes);
        Assert.Equal(string.Empty, version.Checksum);
        Assert.Null(version.Comment);
        Assert.False(version.IsMajor);
    }

    [Fact]
    public void Creator_is_recorded_via_SetCreator()
    {
        var version = new DocumentVersion();
        var userId = Guid.NewGuid();

        version.SetCreator(userId);

        Assert.Equal(userId, version.CreatedBy);
        Assert.NotEqual(default, version.CreatedAt);
    }
}
