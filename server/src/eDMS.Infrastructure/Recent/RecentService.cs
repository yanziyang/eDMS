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
        // SQLite stores DateTimeOffset as a converted value and cannot reliably
        // translate the grouped latest-row shape across all four providers. The
        // user predicate is still served by ix_audit_log_user; grouping the already
        // ordered, narrow audit stream in memory keeps the result provider-portable
        // and preserves the exact latest action/timestamp pair.
        var auditEntries = await db.AuditLogEntries.AsNoTracking()
            .Where(entry => entry.UserId == userId
                && entry.ObjectType == ObjectType.Document
                && (entry.Action == AuditAction.View
                    || entry.Action == AuditAction.Upload
                    || entry.Action == AuditAction.CheckIn
                    || entry.Action == AuditAction.EditMetadata))
            .OrderByDescending(entry => entry.Timestamp)
            .ThenByDescending(entry => entry.Id)
            .Select(entry => new RecentAuditRow(entry.ObjectId, entry.Timestamp, entry.Action))
            .ToListAsync(cancellationToken);

        var recentAudit = auditEntries
            .GroupBy(entry => entry.ObjectId)
            .Select(group => group.First())
            .OrderByDescending(entry => entry.LastTouchedAt)
            .Take(DefaultLimit)
            .ToList();

        if (recentAudit.Count == 0)
        {
            return [];
        }

        var ids = recentAudit.Select(entry => entry.ObjectId).ToList();
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
                audit.LastAction));
        }

        return result;
    }

    private sealed record RecentAuditRow(
        Guid ObjectId,
        DateTimeOffset LastTouchedAt,
        AuditAction LastAction);

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
