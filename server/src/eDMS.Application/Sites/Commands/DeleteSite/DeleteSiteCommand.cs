using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;

namespace eDMS.Application.Sites.Commands.DeleteSite;

public sealed record DeleteSiteCommand(Guid SiteId) : IRequest, IAuthorizableRequest
{
    public ObjectType ObjectType => ObjectType.Site;

    public Guid ObjectId => SiteId;

    public PermissionLevel RequiredLevel => PermissionLevel.FullControl;
}
