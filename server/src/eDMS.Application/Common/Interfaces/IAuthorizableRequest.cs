using eDMS.Domain;

namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Exposes the resource and required level for the <c>AuthorizationBehavior</c>
/// pipeline step. Every mutating request implements this; the handful of public
/// requests instead carry <see cref="AllowAnonymousCheckAttribute"/>.
/// </summary>
public interface IAuthorizableRequest
{
    ObjectType ObjectType { get; }

    Guid ObjectId { get; }

    PermissionLevel RequiredLevel { get; }
}
