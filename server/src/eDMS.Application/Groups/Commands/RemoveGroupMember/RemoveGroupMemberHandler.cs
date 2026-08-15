using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Groups.Commands.RemoveGroupMember;

public sealed class RemoveGroupMemberHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IPermissionCacheInvalidator cacheInvalidator) : IRequestHandler<RemoveGroupMemberCommand>
{
    public async Task Handle(RemoveGroupMemberCommand command, CancellationToken cancellationToken)
    {
        var group = await db.Groups.SingleOrDefaultAsync(item => item.Id == command.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), command.GroupId);

        await AuthorizeAsync(group, cancellationToken);

        var membership = await db.GroupMembers.SingleOrDefaultAsync(
            member => member.GroupId == command.GroupId && member.UserId == command.UserId,
            cancellationToken);
        if (membership is not null)
        {
            db.GroupMembers.Remove(membership);
            await db.SaveChangesAsync(cancellationToken);
            cacheInvalidator.Invalidate();
        }
    }

    private async Task AuthorizeAsync(Group group, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        if (group.SiteId is { } siteId)
        {
            await permissions.RequireAsync(userId, ObjectType.Site, siteId, PermissionLevel.FullControl, cancellationToken);
        }
        else if (!currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException();
        }
    }
}
