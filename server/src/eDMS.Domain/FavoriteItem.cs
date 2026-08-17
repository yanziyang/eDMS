namespace eDMS.Domain;

/// <summary>
/// A user's pinned object. The composite key deliberately contains only the
/// user and polymorphic target columns (FS §8.2 / FR-UI-11).
/// </summary>
public sealed class FavoriteItem
{
    public Guid UserId { get; set; }

    public ObjectType ObjectType { get; set; }

    public Guid ObjectId { get; set; }
}
