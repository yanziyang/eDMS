using eDMS.Domain;

namespace eDMS.Application.Favorites;

public sealed record FavoriteItemDto(
    Guid ObjectId,
    ObjectType ObjectType,
    string Name,
    string Location,
    string SiteSlug,
    Guid? LibraryId,
    Guid? FolderId);
