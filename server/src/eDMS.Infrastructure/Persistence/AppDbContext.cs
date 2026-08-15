using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using eDMS.Infrastructure.Persistence.Configurations;
using eDMS.Application.Common.Interfaces;

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

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasPostgresExtension("citext");
        builder.ApplyConfiguration(new ApplicationUserConfiguration());
        builder.ApplyConfiguration(new RefreshTokenConfiguration());
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
    }
}
