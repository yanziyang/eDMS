namespace eDMS.Application.RecycleBin;

public sealed record RecycleBinItemDto(
    Guid Id,
    string Kind,
    string Name,
    DateTimeOffset? DeletedAt,
    Guid? DeletedBy,
    Guid SiteId);
