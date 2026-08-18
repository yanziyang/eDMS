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

        // The library is resolved here, not trusted from the request: for a root folder
        // it comes from the route, for a child folder it is the parent's actual library.
        // Authorization is then evaluated against that resolved library, so a client can
        // neither bypass the check by claiming a different LibraryId in the body nor get
        // away with omitting it entirely (the frontend sends only { name } for children).
        var libraryId = command.LibraryId;
        var parentPath = "/";
        if (command.ParentFolderId is { } parentId)
        {
            var parent = await db.Folders.SingleOrDefaultAsync(folder => folder.Id == parentId, cancellationToken)
                ?? throw new NotFoundException(nameof(Folder), parentId);
            libraryId = parent.LibraryId;
            parentPath = parent.Path;

            var depth = parentPath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries).Length;
            if (depth >= 20)
            {
                throw new ConflictException("The maximum folder nesting depth of 20 levels has been reached.");
            }
        }

        await permissions.RequireAsync(userId, ObjectType.Library, libraryId, PermissionLevel.Contribute, cancellationToken);

        var folder = new Folder
        {
            LibraryId = libraryId,
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
