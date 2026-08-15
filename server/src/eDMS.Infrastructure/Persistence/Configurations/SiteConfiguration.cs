using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class SiteConfiguration : IEntityTypeConfiguration<Site>
{
    public void Configure(EntityTypeBuilder<Site> builder)
    {
        builder.ToTable("sites");
        builder.HasQueryFilter(site => !site.IsDeleted);

        builder.HasKey(site => site.Id);
        builder.Property(site => site.Name).IsRequired().HasMaxLength(256);
        builder.Property(site => site.UrlSlug).IsRequired().HasMaxLength(128);
        builder.HasIndex(site => site.UrlSlug).IsUnique();
        builder.Property(site => site.Description).HasMaxLength(1024);
    }
}
