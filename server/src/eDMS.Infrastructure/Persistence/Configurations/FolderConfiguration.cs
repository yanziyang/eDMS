using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class FolderConfiguration : IEntityTypeConfiguration<Folder>
{
    public void Configure(EntityTypeBuilder<Folder> builder)
    {
        builder.ToTable("folders");
        builder.HasQueryFilter(folder => !folder.IsDeleted);

        builder.HasKey(folder => folder.Id);
        builder.Property(folder => folder.Name).IsRequired().HasMaxLength(256);
        builder.Property(folder => folder.Path).IsRequired();
        builder.HasIndex(folder => new { folder.LibraryId, folder.ParentFolderId })
            .HasDatabaseName("ix_folders_library_parent");

        builder.HasOne<Library>()
            .WithMany()
            .HasForeignKey(folder => folder.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Folder>()
            .WithMany()
            .HasForeignKey(folder => folder.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
