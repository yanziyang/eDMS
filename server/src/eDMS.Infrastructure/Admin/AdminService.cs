using eDMS.Application.Admin;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Admin;

public sealed class AdminService(
    IAppDbContext db,
    IOptions<StorageOptions> storageOptions,
    IOptions<RecycleBinOptions> recycleBinOptions,
    IOptions<JwtOptions> jwtOptions) : IAdminService
{
    public async Task<IReadOnlyList<AuditLogDto>> ListAuditLogAsync(
        Guid? siteId,
        CancellationToken cancellationToken = default)
    {
        var query = db.AuditLogEntries.AsNoTracking();
        if (siteId is { } id)
        {
            query = query.Where(entry => entry.SiteId == id);
        }

        var entries = await query
            .OrderByDescending(entry => entry.Timestamp)
            .Take(500)
            .ToListAsync(cancellationToken);

        return entries.Select(entry => new AuditLogDto(
            entry.Id,
            entry.Timestamp,
            entry.UserId,
            entry.Action.ToString(),
            entry.ObjectType.ToString(),
            entry.ObjectId,
            entry.ObjectName,
            entry.SiteId,
            entry.IpAddress)).ToList();
    }

    public async Task<IReadOnlyList<StorageReportDto>> GetStorageReportAsync(CancellationToken cancellationToken = default)
    {
        var usage = await (from version in db.DocumentVersions.AsNoTracking()
                           join document in db.Documents.IgnoreQueryFilters() on version.DocumentId equals document.Id
                           join library in db.Libraries.IgnoreQueryFilters() on document.LibraryId equals library.Id
                           group version.SizeBytes by new { library.SiteId } into grouped
                           select new { grouped.Key.SiteId, Used = grouped.Sum() })
            .ToListAsync(cancellationToken);

        var sites = await db.Sites.IgnoreQueryFilters().AsNoTracking().ToListAsync(cancellationToken);
        var report = new List<StorageReportDto>();
        foreach (var site in sites)
        {
            var used = usage.SingleOrDefault(item => item.SiteId == site.Id)?.Used ?? 0;
            report.Add(new StorageReportDto(site.Id, site.Name, used));
        }

        return report.OrderByDescending(item => item.UsedBytes).ToList();
    }

    public Task<AdminSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new AdminSettingsDto(
            storageOptions.Value.MaxUploadSizeBytes,
            recycleBinOptions.Value.RetentionDays,
            jwtOptions.Value.AccessTokenLifetimeMinutes,
            jwtOptions.Value.RefreshTokenLifetimeDays,
            "eDMS"));
    }
}
