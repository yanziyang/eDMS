using eDMS.Application.Sites;
using MediatR;

namespace eDMS.Application.Sites.Queries.ListSites;

public sealed record ListSitesQuery : IRequest<IReadOnlyList<SiteDto>>;
