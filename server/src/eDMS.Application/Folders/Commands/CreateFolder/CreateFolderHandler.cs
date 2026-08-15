using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Folders.Commands.CreateFolder;

public sealed class CreateFolderHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRequestHandler<CreateFolderCommand, Guid>
{
    public async Task<Guid> Handle(CreateFolderCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, command.LibraryId, PermissionLevel.Contribute, cancellationToken);

        var parentPath = "/";
        if (command.ParentFolderId is { } parentId)
        {
            var parent = await db.Folders.SingleOrDefaultAsync(folder => folder.Id == parentId, cancellationToken)
                ?? throw new NotFoundException(nameof(Folder), parentId);
            parentPath = parent.Path;

            var depth = parentPath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries).Length;
            if (depth >= 20)
            {
                throw new ConflictException("The maximum folder nesting depth of 20 levels has been reached.");
            }
        }

        var folder = new Folder
        {
            LibraryId = command.LibraryId,
            ParentFolderId = command.ParentFolderId,
            Name = command.Name,
            Path = $"{parentPath.TrimEnd('/')}/{command.Name}/",
        };
        folder.SetCreator(userId);

        db.Folders.Add(folder);
        await db.SaveChangesAsync(cancellationToken);
        return folder.Id;
    }
}
