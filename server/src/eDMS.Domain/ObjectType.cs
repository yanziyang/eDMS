namespace eDMS.Domain;

/// <summary>
/// The type of object an audit entry or permission grant targets (FS §8.2). The
/// <see cref="User"/> value covers Login/Logout entries, whose action has no
/// document/location counterpart in the spec's object taxonomy.
/// </summary>
public enum ObjectType
{
    Site = 0,
    Library = 1,
    Folder = 2,
    Document = 3,
    User = 4,
}
