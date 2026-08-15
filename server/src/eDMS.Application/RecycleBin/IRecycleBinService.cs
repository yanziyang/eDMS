using eDMS.Domain;

namespace eDMS.Application.RecycleBin;

public interface IRecycleBinService
{
    Task<IReadOnlyList<RecycleBinItemDto>> ListAsync(Guid siteId, CancellationToken cancellationToken = default);

    Task RestoreAsync(ObjectType objectType, Guid itemId, CancellationToken cancellationToken = default);

    Task PermanentlyDeleteAsync(ObjectType objectType, Guid itemId, CancellationToken cancellationToken = default);
}
