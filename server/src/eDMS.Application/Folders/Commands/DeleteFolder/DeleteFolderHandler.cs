using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Folders.Commands.DeleteFolder;

public sealed class DeleteFolderHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRequestHandler<DeleteFolderCommand>
{
    public async Task Handle(DeleteFolderCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var folder = await db.Folders.SingleOrDefaultAsync(item => item.Id == command.FolderId, cancellationToken)
            ?? throw new NotFoundException(nameof(Folder), command.FolderId);

        await permissions.RequireAsync(userId, ObjectType.Library, folder.LibraryId, PermissionLevel.Contribute, cancellationToken);

        var prefix = folder.Path;
        var now = DateTimeOffset.UtcNow;

        var descendants = await db.Folders
            .Where(item => item.Path.StartsWith(prefix))
            .ToListAsync(cancellationToken);
        foreach (var descendant in descendants)
        {
            descendant.MarkDeleted(userId, now);
        }

        var descendantIds = descendants.Select(item => item.Id).ToList();
        var documents = await db.Documents.IgnoreQueryFilters()
            .Where(document => document.FolderId != null && descendantIds.Contains(document.FolderId.Value))
            .ToListAsync(cancellationToken);
        foreach (var document in documents)
        {
            document.MarkDeleted(userId, now);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
