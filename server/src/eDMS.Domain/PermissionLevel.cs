namespace eDMS.Domain;

/// <summary>
/// Permission levels (FS §8.2 ItemPermission). Ordering is meaningful: a lower
/// numeric value is a higher level (FullControl &gt; Contribute &gt; Read &gt; NoAccess).
/// </summary>
public enum PermissionLevel
{
    FullControl = 0,
    Contribute = 1,
    Read = 2,
    NoAccess = 3,
}
