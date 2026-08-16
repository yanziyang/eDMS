namespace eDMS.Application.Common.Interfaces;

public interface ICurrentUser
{
    Guid? UserId { get; }

    bool IsSystemAdmin { get; }

    string? Email { get; }

    string? IpAddress { get; }

    /// <summary>
    /// The org-wide share-link token presented via the X-Share-Token header
    /// (FR-PERM-07). Consulted by the permission resolver as an additional grant
    /// source on every request.
    /// </summary>
    string? ShareToken { get; }
}
