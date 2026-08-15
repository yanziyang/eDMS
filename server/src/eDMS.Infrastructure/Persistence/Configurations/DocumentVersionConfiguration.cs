using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class DocumentVersionConfiguration : IEntityTypeConfiguration<DocumentVersion>
{
    public void Configure(EntityTypeBuilder<DocumentVersion> builder)
    {
        builder.ToTable("document_versions");

        builder.HasKey(version => version.Id);
        builder.Property(version => version.StorageKey).IsRequired();
        builder.Property(version => version.Checksum).IsRequired();
        builder.HasIndex(version => new { version.DocumentId, version.VersionMajor, version.VersionMinor }).IsUnique();

        builder.HasOne<Document>()
            .WithMany()
            .HasForeignKey(version => version.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
