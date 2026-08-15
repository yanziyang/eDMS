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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
