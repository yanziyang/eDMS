using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;

namespace eDMS.Application.Sites.Commands.UpdateSite;

public sealed record UpdateSiteCommand(Guid SiteId, string Name, string? Description, long? StorageQuotaBytes)
    : IRequest, IAuthorizableRequest
{
    public ObjectType ObjectType => ObjectType.Site;

    public Guid ObjectId => SiteId;

    public PermissionLevel RequiredLevel => PermissionLevel.FullControl;
}
