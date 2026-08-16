using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace eDMS.Infrastructure.Persistence.Configurations;

public sealed class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.ToTable("audit_log_entries");

        builder.HasKey(entry => entry.Id);

        builder.Property(entry => entry.ObjectName).IsRequired();

        builder.HasIndex(entry => entry.Timestamp).HasDatabaseName("ix_audit_log_timestamp").IsDescending();
        builder.HasIndex(entry => new { entry.SiteId, entry.Timestamp }).HasDatabaseName("ix_audit_log_site_timestamp");
        builder.HasIndex(entry => entry.UserId).HasDatabaseName("ix_audit_log_user");

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(entry => entry.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
