using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class DocumentConfiguration : IEntityTypeConfiguration<Document>
{
    public void Configure(EntityTypeBuilder<Document> builder)
    {
        builder.ToTable("documents");
        builder.HasQueryFilter(document => !document.IsDeleted);

        builder.HasKey(document => document.Id);
        builder.Property(document => document.Name).IsRequired().HasMaxLength(512);
        builder.Property(document => document.Title).HasMaxLength(512);
        builder.Property(document => document.ContentType).IsRequired().HasMaxLength(128);
        builder.HasIndex(document => new { document.LibraryId, document.FolderId })
            .HasDatabaseName("ix_documents_folder");

        builder.HasOne<Library>()
            .WithMany()
            .HasForeignKey(document => document.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Folder>()
            .WithMany()
            .HasForeignKey(document => document.FolderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
