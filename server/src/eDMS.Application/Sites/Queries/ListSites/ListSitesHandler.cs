using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Sites.Queries.ListSites;

public sealed class ListSitesHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRequestHandler<ListSitesQuery, IReadOnlyList<SiteDto>>
{
    public async Task<IReadOnlyList<SiteDto>> Handle(ListSitesQuery query, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new Common.Exceptions.ForbiddenException();
        var sites = await db.Sites
            .AsNoTracking()
            .OrderBy(site => site.Name)
            .ToListAsync(cancellationToken);

        var visible = new List<SiteDto>();
        foreach (var site in sites)
        {
            var level = await permissions.GetEffectiveLevelAsync(userId, ObjectType.Site, site.Id, cancellationToken);
            if (level != PermissionLevel.NoAccess)
            {
                visible.Add(new SiteDto(
                    site.Id,
                    site.Name,
                    site.Description,
                    site.UrlSlug,
                    site.StorageQuotaBytes,
                    site.StorageUsedBytes,
                    site.CreatedAt));
            }
        }

        return visible;
    }
}
