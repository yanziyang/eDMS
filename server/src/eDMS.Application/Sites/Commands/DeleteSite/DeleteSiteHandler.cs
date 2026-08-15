using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Sites.Commands.DeleteSite;

public sealed class DeleteSiteHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionCacheInvalidator cacheInvalidator) : IRequestHandler<DeleteSiteCommand>
{
    public async Task Handle(DeleteSiteCommand command, CancellationToken cancellationToken)
    {
        var site = await db.Sites.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == command.SiteId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Site), command.SiteId);

        site.MarkDeleted(currentUser.UserId ?? Guid.Empty, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();
    }
}
