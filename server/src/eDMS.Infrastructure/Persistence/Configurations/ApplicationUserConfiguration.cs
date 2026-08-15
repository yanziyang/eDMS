using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        // citext gives case-insensitive comparison and uniqueness on email,
        // matching the FS §8.2 recommendation.
        builder.Property(user => user.Email).HasColumnType("citext");
        builder.HasIndex(user => user.Email).IsUnique();

        builder.Property(user => user.DisplayName).IsRequired().HasMaxLength(256);
        builder.Property(user => user.ExternalId).HasMaxLength(512);
        builder.Property(user => user.AvatarUrl).HasMaxLength(2048);

        builder.Property(user => user.IsActive).HasDefaultValue(true);
        builder.Property(user => user.IsSystemAdmin).HasDefaultValue(false);
        builder.Property(user => user.MustChangePassword).HasDefaultValue(false);
        builder.Property(user => user.AuthProvider).HasDefaultValue(AuthProvider.Local);
        builder.Property(user => user.CreatedAt).HasDefaultValueSql("now()");
    }
}
