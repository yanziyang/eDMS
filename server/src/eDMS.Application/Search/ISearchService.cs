namespace eDMS.Application.Search;

public interface ISearchService
{
    Task<IReadOnlyList<SearchResultItemDto>> SearchAsync(
        string? query,
        Guid? siteId,
        Guid? libraryId,
        CancellationToken cancellationToken = default);
}
