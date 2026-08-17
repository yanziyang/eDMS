using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Recent;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Recent;

public sealed class RecentService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRecentService
{
    private const int DefaultLimit = 20;

    public async Task<IReadOnlyList<RecentDocumentDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var recentAudit = await db.AuditLogEntries.AsNoTracking()
            .Where(entry => entry.UserId == userId
                && entry.ObjectType == ObjectType.Document
                && (entry.Action == AuditAction.View
                    || entry.Action == AuditAction.Upload
                    || entry.Action == AuditAction.CheckIn
                    || entry.Action == AuditAction.EditMetadata))
            .GroupBy(entry => entry.ObjectId)
            .Select(group => new RecentAuditRow(
                group.Key,
                group.Max(entry => entry.Timestamp)))
            .OrderByDescending(entry => entry.LastTouchedAt)
            .Take(DefaultLimit)
            .ToListAsync(cancellationToken);

        if (recentAudit.Count == 0)
        {
            return [];
        }

        var ids = recentAudit.Select(entry => entry.ObjectId).ToList();
        // The grouped query above gives us the timestamp/order. Resolve the
        // corresponding action for all selected documents in one additional query,
        // rather than looking it up once per row.
        var latestActions = await db.AuditLogEntries.AsNoTracking()
            .Where(entry => entry.UserId == userId
                && entry.ObjectType == ObjectType.Document
                && ids.Contains(entry.ObjectId)
                && (entry.Action == AuditAction.View
                    || entry.Action == AuditAction.Upload
                    || entry.Action == AuditAction.CheckIn
                    || entry.Action == AuditAction.EditMetadata))
            .OrderByDescending(entry => entry.Timestamp)
            .ThenByDescending(entry => entry.Id)
            .ToListAsync(cancellationToken);
        var actionByDocumentId = latestActions
            .GroupBy(entry => entry.ObjectId)
            .ToDictionary(group => group.Key, group => group.First().Action);

        var documents = await (
            from document in db.Documents.AsNoTracking()
            join library in db.Libraries.AsNoTracking() on document.LibraryId equals library.Id
            join site in db.Sites.AsNoTracking() on library.SiteId equals site.Id
            join folder in db.Folders.AsNoTracking() on document.FolderId equals folder.Id into folders
            from folder in folders.DefaultIfEmpty()
            where ids.Contains(document.Id) && (document.FolderId == null || folder != null)
            select new RecentDocumentTarget(
                document.Id,
                document.Name,
                site.Id,
                site.Name,
                site.UrlSlug,
                library.Id,
                library.Name,
                document.FolderId,
                folder == null ? null : folder.Path)
        ).ToListAsync(cancellationToken);

        var byId = documents.ToDictionary(document => document.DocumentId);
        var result = new List<RecentDocumentDto>(recentAudit.Count);
        foreach (var audit in recentAudit)
        {
            if (!byId.TryGetValue(audit.ObjectId, out var document))
            {
                continue;
            }

            var level = await permissions.GetEffectiveLevelAsync(
                userId,
                ObjectType.Document,
                document.DocumentId,
                cancellationToken);
            if (level == PermissionLevel.NoAccess)
            {
                continue;
            }

            result.Add(new RecentDocumentDto(
                document.DocumentId,
                document.Name,
                document.SiteId,
                document.SiteName,
                document.SiteSlug,
                document.LibraryId,
                document.LibraryName,
                document.FolderId,
                document.FolderPath,
                audit.LastTouchedAt,
                actionByDocumentId.GetValueOrDefault(audit.ObjectId, AuditAction.View)));
        }

        return result;
    }

    private sealed record RecentAuditRow(Guid ObjectId, DateTimeOffset LastTouchedAt);

    private sealed record RecentDocumentTarget(
        Guid DocumentId,
        string Name,
        Guid SiteId,
        string SiteName,
        string SiteSlug,
        Guid LibraryId,
        string LibraryName,
        Guid? FolderId,
        string? FolderPath);
}
