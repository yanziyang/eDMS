using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Abstraction over <c>AppDbContext</c> so Application handlers depend on the
/// contract rather than the EF implementation (TDS §5.2).
/// </summary>
public interface IAppDbContext
{
    DbSet<ApplicationUser> Users { get; }

    DbSet<Site> Sites { get; }

    DbSet<Library> Libraries { get; }

    DbSet<Group> Groups { get; }

    DbSet<GroupMember> GroupMembers { get; }

    DbSet<SitePermission> SitePermissions { get; }

    DbSet<AuditLogEntry> AuditLogEntries { get; }

    DbSet<Folder> Folders { get; }

    DbSet<Document> Documents { get; }

    DbSet<DocumentVersion> DocumentVersions { get; }

    DbSet<Tag> Tags { get; }

    DbSet<DocumentTag> DocumentTags { get; }

    DbSet<ItemPermission> ItemPermissions { get; }

    DbSet<AppSetting> AppSettings { get; }

    DbSet<ContentType> ContentTypes { get; }

    DbSet<ColumnDefinition> ColumnDefinitions { get; }

    DbSet<DocumentColumnValue> DocumentColumnValues { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
