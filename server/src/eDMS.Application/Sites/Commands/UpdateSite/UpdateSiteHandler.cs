using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Sites.Commands.UpdateSite;

public sealed class UpdateSiteHandler(IAppDbContext db) : IRequestHandler<UpdateSiteCommand>
{
    public async Task Handle(UpdateSiteCommand command, CancellationToken cancellationToken)
    {
        var site = await db.Sites.SingleOrDefaultAsync(item => item.Id == command.SiteId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Site), command.SiteId);

        site.Name = command.Name;
        site.Description = command.Description;
        site.StorageQuotaBytes = command.StorageQuotaBytes;

        await db.SaveChangesAsync(cancellationToken);
    }
}
