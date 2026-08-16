using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        // Case-insensitive comparison and uniqueness on email (FS §8.2): citext on
        // Postgres, NOCASE collation on SQLite, and the default case-insensitive
        // collations on SqlServer/MySql. Applied in AppDbContext.ApplyProviderSpecificColumnTypes.
        builder.HasIndex(user => user.Email).IsUnique();

        builder.Property(user => user.DisplayName).IsRequired().HasMaxLength(256);
        builder.Property(user => user.ExternalId).HasMaxLength(512);
        builder.Property(user => user.AvatarUrl).HasMaxLength(2048);

        builder.Property(user => user.IsActive).HasDefaultValue(true);
        builder.Property(user => user.IsSystemAdmin).HasDefaultValue(false);
        builder.Property(user => user.MustChangePassword).HasDefaultValue(false);
        builder.Property(user => user.AuthProvider).HasDefaultValue(AuthProvider.Local);
    }
}
