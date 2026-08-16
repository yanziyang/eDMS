using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class DocumentTagTests
{
    [Fact]
    public void Composite_key_properties_round_trip()
    {
        var documentId = Guid.NewGuid();
        var tagId = Guid.NewGuid();

        var link = new DocumentTag
        {
            DocumentId = documentId,
            TagId = tagId,
        };

        Assert.Equal(documentId, link.DocumentId);
        Assert.Equal(tagId, link.TagId);
    }

    [Fact]
    public void New_link_defaults_to_empty_guids()
    {
        var link = new DocumentTag();

        Assert.Equal(Guid.Empty, link.DocumentId);
        Assert.Equal(Guid.Empty, link.TagId);
    }
}
