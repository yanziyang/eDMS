using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Groups.Commands.DeleteGroup;

public sealed class DeleteGroupHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IPermissionCacheInvalidator cacheInvalidator) : IRequestHandler<DeleteGroupCommand>
{
    public async Task Handle(DeleteGroupCommand command, CancellationToken cancellationToken)
    {
        var group = await db.Groups.SingleOrDefaultAsync(item => item.Id == command.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), command.GroupId);

        if (group.IsSystem)
        {
            throw new ConflictException("Built-in site groups cannot be deleted.");
        }

        var userId = currentUser.UserId ?? throw new ForbiddenException();
        if (group.SiteId is { } siteId)
        {
            await permissions.RequireAsync(userId, ObjectType.Site, siteId, PermissionLevel.FullControl, cancellationToken);
        }
        else if (!currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException();
        }

        db.Groups.Remove(group);
        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();
    }
}
