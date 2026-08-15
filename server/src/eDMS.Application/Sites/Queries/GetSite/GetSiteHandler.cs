using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Sites.Queries.GetSite;

public sealed class GetSiteHandler(IAppDbContext db) : IRequestHandler<GetSiteQuery, SiteDto>
{
    public async Task<SiteDto> Handle(GetSiteQuery query, CancellationToken cancellationToken)
    {
        var site = await db.Sites
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == query.SiteId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Site), query.SiteId);

        return new SiteDto(
            site.Id,
            site.Name,
            site.Description,
            site.UrlSlug,
            site.StorageQuotaBytes,
            site.StorageUsedBytes,
            site.CreatedAt);
    }
}
