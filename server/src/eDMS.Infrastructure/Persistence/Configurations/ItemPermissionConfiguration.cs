using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class ItemPermissionConfiguration : IEntityTypeConfiguration<ItemPermission>
{
    public void Configure(EntityTypeBuilder<ItemPermission> builder)
    {
        builder.ToTable("item_permissions");

        builder.HasKey(permission => permission.Id);
        builder.HasIndex(permission => new { permission.ObjectType, permission.ObjectId, permission.PrincipalType, permission.PrincipalId })
            .IsUnique();
        builder.HasIndex(permission => new { permission.ObjectType, permission.ObjectId })
            .HasDatabaseName("ix_item_permissions_object");
    }
}
