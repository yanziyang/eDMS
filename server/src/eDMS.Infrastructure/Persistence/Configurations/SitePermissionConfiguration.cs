using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class SitePermissionConfiguration : IEntityTypeConfiguration<SitePermission>
{
    public void Configure(EntityTypeBuilder<SitePermission> builder)
    {
        builder.ToTable("site_permissions");

        builder.HasKey(permission => permission.Id);
        builder.HasIndex(permission => new { permission.SiteId, permission.PrincipalType, permission.PrincipalId })
            .IsUnique();

        builder.HasOne<Site>()
            .WithMany()
            .HasForeignKey(permission => permission.SiteId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
