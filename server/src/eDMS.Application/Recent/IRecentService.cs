namespace eDMS.Application.Recent;

public interface IRecentService
{
    Task<IReadOnlyList<RecentDocumentDto>> ListAsync(CancellationToken cancellationToken = default);
}
