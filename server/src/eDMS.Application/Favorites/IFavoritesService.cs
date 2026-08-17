using eDMS.Domain;

namespace eDMS.Application.Favorites;

public interface IFavoritesService
{
    Task AddAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task RemoveAsync(
        ObjectType objectType,
        Guid objectId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FavoriteItemDto>> ListAsync(
        CancellationToken cancellationToken = default);
}
