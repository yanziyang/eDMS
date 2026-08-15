using eDMS.Application.Common.Interfaces;
using eDMS.Application.Groups;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Groups.Queries.ListGroups;

public sealed class ListGroupsHandler(IAppDbContext db) : IRequestHandler<ListGroupsQuery, IReadOnlyList<GroupDto>>
{
    public async Task<IReadOnlyList<GroupDto>> Handle(ListGroupsQuery query, CancellationToken cancellationToken)
    {
        var groups = await db.Groups
            .AsNoTracking()
            .Where(group => query.SiteId == null || group.SiteId == query.SiteId)
            .OrderBy(group => group.Name)
            .ToListAsync(cancellationToken);

        var memberships = await db.GroupMembers
            .AsNoTracking()
            .Where(member => groups.Select(group => group.Id).Contains(member.GroupId))
            .ToListAsync(cancellationToken);

        return groups
            .Select(group => new GroupDto(
                group.Id,
                group.Name,
                group.Description,
                group.IsSystem,
                group.SiteId,
                memberships.Where(member => member.GroupId == group.Id).Select(member => member.UserId).ToList()))
            .ToList();
    }
}
