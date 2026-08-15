using eDMS.Application.Groups;
using MediatR;

namespace eDMS.Application.Groups.Queries.ListGroups;

public sealed record ListGroupsQuery(Guid? SiteId) : IRequest<IReadOnlyList<GroupDto>>;
