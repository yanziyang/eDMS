using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class GroupConfiguration : IEntityTypeConfiguration<Group>
{
    public void Configure(EntityTypeBuilder<Group> builder)
    {
        builder.ToTable("groups");

        builder.HasKey(group => group.Id);
        builder.Property(group => group.Name).IsRequired().HasMaxLength(256);
        builder.HasIndex(group => group.Name).IsUnique();
        builder.Property(group => group.Description).HasMaxLength(1024);

        builder.HasOne<Site>()
            .WithMany()
            .HasForeignKey(group => group.SiteId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
