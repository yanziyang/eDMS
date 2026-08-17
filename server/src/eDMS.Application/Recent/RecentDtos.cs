using eDMS.Domain;

namespace eDMS.Application.Recent;

public sealed record RecentDocumentDto(
    Guid DocumentId,
    string Name,
    Guid SiteId,
    string SiteName,
    string SiteSlug,
    Guid LibraryId,
    string LibraryName,
    Guid? FolderId,
    string? FolderPath,
    DateTimeOffset LastTouchedAt,
    AuditAction LastAction);
