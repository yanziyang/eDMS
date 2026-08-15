using eDMS.Application.Sites;
using MediatR;

namespace eDMS.Application.Sites.Queries.GetSite;

public sealed record GetSiteQuery(Guid SiteId) : IRequest<SiteDto>;
