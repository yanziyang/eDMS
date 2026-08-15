using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class DocumentTagConfiguration : IEntityTypeConfiguration<DocumentTag>
{
    public void Configure(EntityTypeBuilder<DocumentTag> builder)
    {
        builder.ToTable("document_tags");
        builder.HasKey(documentTag => new { documentTag.DocumentId, documentTag.TagId });

        builder.HasOne<Document>()
            .WithMany()
            .HasForeignKey(documentTag => documentTag.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Tag>()
            .WithMany()
            .HasForeignKey(documentTag => documentTag.TagId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
