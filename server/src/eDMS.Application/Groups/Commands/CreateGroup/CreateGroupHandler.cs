using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Groups.Commands.CreateGroup;

public sealed class CreateGroupHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IPermissionCacheInvalidator cacheInvalidator) : IRequestHandler<CreateGroupCommand, Guid>
{
    public async Task<Guid> Handle(CreateGroupCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        if (command.SiteId is { } siteId)
        {
            await permissions.RequireAsync(userId, ObjectType.Site, siteId, PermissionLevel.FullControl, cancellationToken);
        }
        else if (!currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException();
        }

        var duplicate = await db.Groups.AnyAsync(group => group.Name == command.Name, cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A group with this name already exists.");
        }

        var group = new Group
        {
            Name = command.Name,
            Description = command.Description,
            IsSystem = false,
            SiteId = command.SiteId,
        };
        group.SetCreator(userId);

        db.Groups.Add(group);
        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();

        return group.Id;
    }
}
