using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Folders.Commands.RenameFolder;

public sealed class RenameFolderHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRequestHandler<RenameFolderCommand>
{
    public async Task Handle(RenameFolderCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var folder = await db.Folders.SingleOrDefaultAsync(item => item.Id == command.FolderId, cancellationToken)
            ?? throw new NotFoundException(nameof(Folder), command.FolderId);

        await permissions.RequireAsync(userId, ObjectType.Library, folder.LibraryId, PermissionLevel.Contribute, cancellationToken);

        var oldPrefix = folder.Path;
        var parent = oldPrefix.TrimEnd('/').LastIndexOf('/');
        var newPath = oldPrefix[..(parent + 1)] + command.Name + "/";

        folder.Name = command.Name;
        folder.Path = newPath;
        folder.ModifiedBy = userId;
        folder.ModifiedAt = DateTimeOffset.UtcNow;

        var descendants = await db.Folders
            .Where(item => item.Path.StartsWith(oldPrefix))
            .ToListAsync(cancellationToken);
        foreach (var descendant in descendants)
        {
            descendant.Path = newPath + descendant.Path[oldPrefix.Length..];
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
