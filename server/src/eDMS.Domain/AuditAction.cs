namespace eDMS.Domain;

/// <summary>
/// The immutable actions recorded in the audit log (FS §8.2).
/// </summary>
public enum AuditAction
{
    Upload = 0,
    Download = 1,
    View = 2,
    EditMetadata = 3,
    Delete = 4,
    Restore = 5,
    Rename = 6,
    Move = 7,
    Copy = 8,
    CheckOut = 9,
    CheckIn = 10,
    DiscardCheckout = 11,
    PermissionChange = 12,
    Share = 13,
    Login = 14,
    Logout = 15,
}
