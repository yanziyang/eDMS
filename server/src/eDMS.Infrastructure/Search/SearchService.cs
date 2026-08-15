using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Search;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Search;

public sealed class SearchService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : ISearchService
{
    public async Task<IReadOnlyList<SearchResultItemDto>> SearchAsync(
        string? query,
        Guid? siteId,
        Guid? libraryId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();

        IQueryable<Document> documents = db.Documents.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = $"%{query}%";
            documents = documents.Where(document =>
                EF.Functions.ILike(document.Name, pattern)
                || (document.Title != null && EF.Functions.ILike(document.Title, pattern))
                || (document.Description != null && EF.Functions.ILike(document.Description, pattern)));
        }

        if (libraryId is { } libId)
        {
            documents = documents.Where(document => document.LibraryId == libId);
        }
        else if (siteId is { } sId)
        {
            var libraryIds = db.Libraries.Where(library => library.SiteId == sId).Select(library => library.Id);
            documents = documents.Where(document => libraryIds.Contains(document.LibraryId));
        }

        var candidates = await documents
            .OrderByDescending(document => document.ModifiedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        var results = new List<SearchResultItemDto>();
        foreach (var document in candidates)
        {
            var level = await permissions.GetEffectiveLevelAsync(userId, ObjectType.Document, document.Id, cancellationToken);
            if (level == PermissionLevel.NoAccess)
            {
                continue;
            }

            var folderPath = document.FolderId is { } folderId
                ? await db.Folders.IgnoreQueryFilters().Where(folder => folder.Id == folderId).Select(folder => folder.Path).SingleOrDefaultAsync(cancellationToken)
                : "/";

            results.Add(new SearchResultItemDto(
                document.Id,
                document.Name,
                0,
                await db.Libraries.IgnoreQueryFilters().Where(library => library.Id == document.LibraryId).Select(library => library.SiteId).SingleAsync(cancellationToken),
                document.LibraryId,
                folderPath,
                document.ModifiedAt ?? document.CreatedAt));
        }

        return results;
    }
}
