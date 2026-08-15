namespace eDMS.Application.Common.Interfaces;

public interface ICurrentUser
{
    Guid? UserId { get; }

    bool IsSystemAdmin { get; }

    string? Email { get; }

    string? IpAddress { get; }
}
