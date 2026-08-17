using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using eDMS.Infrastructure.Persistence.Configurations;
using eDMS.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace eDMS.Infrastructure.Persistence;

/// <summary>
/// EF Core database context. Entity <see cref="DbSet{TEntity}"/> properties are
/// added as domain entities land in later milestones.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IAppDbContext
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();

    public DbSet<Site> Sites => Set<Site>();

    public DbSet<Library> Libraries => Set<Library>();

    public DbSet<Group> Groups => Set<Group>();

    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();

    public DbSet<SitePermission> SitePermissions => Set<SitePermission>();

    public DbSet<Folder> Folders => Set<Folder>();

    public DbSet<Document> Documents => Set<Document>();

    public DbSet<DocumentVersion> DocumentVersions => Set<DocumentVersion>();

    public DbSet<Tag> Tags => Set<Tag>();

    public DbSet<DocumentTag> DocumentTags => Set<DocumentTag>();

    public DbSet<ItemPermission> ItemPermissions => Set<ItemPermission>();

    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    public DbSet<ContentType> ContentTypes => Set<ContentType>();

    public DbSet<ColumnDefinition> ColumnDefinitions => Set<ColumnDefinition>();

    public DbSet<DocumentColumnValue> DocumentColumnValues => Set<DocumentColumnValue>();

    public DbSet<UploadSession> UploadSessions => Set<UploadSession>();

    public DbSet<ShareLink> ShareLinks => Set<ShareLink>();

    public DbSet<AlertSubscription> AlertSubscriptions => Set<AlertSubscription>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<FavoriteItem> FavoriteItems => Set<FavoriteItem>();

    public DbSet<LibraryView> LibraryViews => Set<LibraryView>();

    public DbSet<SsoHandoffCode> SsoHandoffCodes => Set<SsoHandoffCode>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // The SQLite provider has no DateTimeOffset support; store as UTC binary.
        if (Database.IsSqlite())
        {
            configurationBuilder.Properties<DateTimeOffset>()
                .HaveConversion<DateTimeOffsetToBinaryConverter>();
            configurationBuilder.Properties<DateTimeOffset?>()
                .HaveConversion<DateTimeOffsetToBinaryConverter>();
        }
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        if (Database.IsNpgsql())
        {
            builder.HasPostgresExtension("citext");
        }

        builder.ApplyConfiguration(new ApplicationUserConfiguration());
        builder.ApplyConfiguration(new RefreshTokenConfiguration());
        builder.ApplyConfiguration(new SsoHandoffCodeConfiguration());
        builder.ApplyConfiguration(new AuditLogEntryConfiguration());
        builder.ApplyConfiguration(new SiteConfiguration());
        builder.ApplyConfiguration(new LibraryConfiguration());
        builder.ApplyConfiguration(new GroupConfiguration());
        builder.ApplyConfiguration(new GroupMemberConfiguration());
        builder.ApplyConfiguration(new SitePermissionConfiguration());
        builder.ApplyConfiguration(new FolderConfiguration());
        builder.ApplyConfiguration(new DocumentConfiguration());
        builder.ApplyConfiguration(new DocumentVersionConfiguration());
        builder.ApplyConfiguration(new TagConfiguration());
        builder.ApplyConfiguration(new DocumentTagConfiguration());
        builder.ApplyConfiguration(new ItemPermissionConfiguration());

        builder.Entity<AppSetting>(entity =>
        {
            entity.ToTable("app_settings");
            entity.HasKey(setting => setting.Key);
            entity.Property(setting => setting.Key).HasMaxLength(128);
            entity.Property(setting => setting.Value).HasMaxLength(2048);
        });

        builder.Entity<ContentType>(entity =>
        {
            entity.ToTable("content_types");
            entity.Property(contentType => contentType.Name).IsRequired().HasMaxLength(256);
            entity.Property(contentType => contentType.Description).HasMaxLength(1024);
            entity.HasOne<Library>()
                .WithMany()
                .HasForeignKey(contentType => contentType.LibraryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ColumnDefinition>(entity =>
        {
            entity.ToTable("column_definitions");
            entity.Property(column => column.Name).IsRequired().HasMaxLength(256);
            entity.Property(column => column.ChoiceOptions).HasMaxLength(4096);
            entity.Property(column => column.DefaultValue).HasMaxLength(2048);
            entity.HasOne<ContentType>()
                .WithMany()
                .HasForeignKey(column => column.ContentTypeId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(column => new { column.ContentTypeId, column.Name }).IsUnique();
        });

        builder.Entity<DocumentColumnValue>(entity =>
        {
            entity.ToTable("document_column_values");
            entity.HasKey(value => new { value.DocumentId, value.ColumnDefinitionId });
            entity.Property(value => value.Value).IsRequired().HasMaxLength(4096);
            entity.HasOne<Document>()
                .WithMany()
                .HasForeignKey(value => value.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ColumnDefinition>()
                .WithMany()
                .HasForeignKey(value => value.ColumnDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UploadSession>(entity =>
        {
            entity.ToTable("upload_sessions");
            entity.Property(session => session.FileName).IsRequired().HasMaxLength(512);
            entity.Property(session => session.MetadataJson).HasMaxLength(4096);
            entity.HasIndex(session => session.ExpiresAt);
        });

        builder.Entity<ShareLink>(entity =>
        {
            entity.ToTable("share_links");
            entity.Property(link => link.Token).IsRequired().HasMaxLength(64);
            entity.HasIndex(link => link.Token).IsUnique();
            entity.HasIndex(link => new { link.ObjectType, link.ObjectId });
        });

        builder.Entity<AlertSubscription>(entity =>
        {
            entity.ToTable("alert_subscriptions");
            entity.HasKey(subscription => subscription.Id);
            entity.HasIndex(subscription => new
            {
                subscription.UserId,
                subscription.ObjectType,
                subscription.ObjectId,
            }).IsUnique();
            entity.HasIndex(subscription => subscription.ObjectId);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(subscription => subscription.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(notification => notification.Id);
            entity.Property(notification => notification.ObjectName).IsRequired().HasMaxLength(512);
            entity.Property(notification => notification.Message).IsRequired().HasMaxLength(2048);
            entity.HasIndex(notification => new { notification.UserId, notification.CreatedAt });
            entity.HasIndex(notification => new
            {
                notification.UserId,
                notification.IsRead,
                notification.CreatedAt,
            });
            entity.HasIndex(notification => new
            {
                notification.EmailSentAt,
                notification.Frequency,
                notification.CreatedAt,
            });
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(notification => notification.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FavoriteItem>(entity =>
        {
            entity.ToTable("favorite_items");
            entity.HasKey(favorite => new
            {
                favorite.UserId,
                favorite.ObjectType,
                favorite.ObjectId,
            });
            entity.HasIndex(favorite => new { favorite.ObjectType, favorite.ObjectId });
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(favorite => favorite.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<LibraryView>(entity =>
        {
            entity.ToTable("library_views");
            entity.HasKey(view => view.Id);
            entity.Property(view => view.Name).IsRequired().HasMaxLength(256);
            entity.Property(view => view.FilterConfig).IsRequired().HasMaxLength(16 * 1024);
            entity.Property(view => view.SortConfig).IsRequired().HasMaxLength(16 * 1024);
            entity.Property(view => view.GroupByColumn).HasMaxLength(128);
            entity.HasIndex(view => new { view.LibraryId, view.OwnerId, view.Name }).IsUnique();
            entity.HasIndex(view => new { view.LibraryId, view.IsDefault });
            entity.HasOne<Library>()
                .WithMany()
                .HasForeignKey(view => view.LibraryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(view => view.OwnerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        ApplyProviderSpecificColumnTypes(builder);
    }

    /// <summary>
    /// Column types and database defaults that differ per provider (ADR-8).
    /// Postgres keeps citext/jsonb/timestamptz and its <c>now()</c> defaults; SQLite
    /// uses a NOCASE collation for the unique email index and app-set timestamps;
    /// SqlServer/MySql rely on their default case-insensitive collations and use
    /// their own UTC timestamp defaults.
    /// </summary>
    private void ApplyProviderSpecificColumnTypes(ModelBuilder builder)
    {
        var userEmail = builder.Entity<ApplicationUser>().Property(user => user.Email);
        var userCreatedAt = builder.Entity<ApplicationUser>().Property(user => user.CreatedAt);
        var auditTimestamp = builder.Entity<AuditLogEntry>().Property(entry => entry.Timestamp);
        var auditDetails = builder.Entity<AuditLogEntry>().Property(entry => entry.Details);

        if (Database.IsNpgsql())
        {
            userEmail.HasColumnType("citext");
            userCreatedAt.HasDefaultValueSql("now()");
            auditTimestamp.HasDefaultValueSql("now()");
            auditDetails.HasColumnType("jsonb");
        }
        else if (Database.IsSqlite())
        {
            userEmail.UseCollation("NOCASE");
        }
        else if (Database.IsSqlServer())
        {
            userCreatedAt.HasDefaultValueSql("SYSDATETIMEOFFSET()");
            auditTimestamp.HasDefaultValueSql("SYSDATETIMEOFFSET()");
        }
        else if (IsMySql())
        {
            userCreatedAt.HasDefaultValueSql("CURRENT_TIMESTAMP(6)");
            auditTimestamp.HasDefaultValueSql("CURRENT_TIMESTAMP(6)");
        }
    }

    private bool IsMySql() =>
        Database.ProviderName?.StartsWith("MySql", StringComparison.OrdinalIgnoreCase) == true;
}
