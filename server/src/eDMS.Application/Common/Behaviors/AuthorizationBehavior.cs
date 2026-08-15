using eDMS.Application.Common.Interfaces;
using MediatR;

namespace eDMS.Application.Common.Behaviors;

/// <summary>
/// The server-authoritative permission gate. Runs before the handler for any
/// <see cref="IAuthorizableRequest"/> not marked <see cref="AllowAnonymousCheckAttribute"/>.
/// </summary>
public sealed class AuthorizationBehavior<TRequest, TResponse>(
    IPermissionResolver permissions,
    ICurrentUser currentUser)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is IAuthorizableRequest authorizable
            && !Attribute.IsDefined(request.GetType(), typeof(AllowAnonymousCheckAttribute)))
        {
            var userId = currentUser.UserId
                ?? throw new Common.Exceptions.ForbiddenException("Authentication is required.");

            await permissions.RequireAsync(
                userId,
                authorizable.ObjectType,
                authorizable.ObjectId,
                authorizable.RequiredLevel,
                cancellationToken);
        }

        return await next();
    }
}
