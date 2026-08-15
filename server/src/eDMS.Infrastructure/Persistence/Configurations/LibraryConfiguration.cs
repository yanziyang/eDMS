using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class LibraryConfiguration : IEntityTypeConfiguration<Library>
{
    public void Configure(EntityTypeBuilder<Library> builder)
    {
        builder.ToTable("libraries");
        builder.HasQueryFilter(library => !library.IsDeleted);

        builder.HasKey(library => library.Id);
        builder.Property(library => library.Name).IsRequired().HasMaxLength(256);
        builder.Property(library => library.Description).HasMaxLength(1024);

        builder.HasOne<Site>()
            .WithMany()
            .HasForeignKey(library => library.SiteId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
