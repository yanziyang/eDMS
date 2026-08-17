using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class SsoHandoffCodeConfiguration : IEntityTypeConfiguration<SsoHandoffCode>
{
    public void Configure(EntityTypeBuilder<SsoHandoffCode> builder)
    {
        builder.ToTable("sso_handoff_codes");
        builder.HasKey(code => code.Id);

        builder.Property(code => code.CodeHash)
            .IsRequired()
            .HasMaxLength(64);
        builder.HasIndex(code => code.CodeHash).IsUnique();
        builder.HasIndex(code => code.ExpiresAt);

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(code => code.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
