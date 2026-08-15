using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;

namespace eDMS.Application.Libraries.Commands.CreateLibrary;

public sealed class CreateLibraryHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : IRequestHandler<CreateLibraryCommand, Guid>
{
    public async Task<Guid> Handle(CreateLibraryCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Site, command.SiteId, PermissionLevel.Contribute, cancellationToken);

        var library = new Library
        {
            SiteId = command.SiteId,
            Name = command.Name,
            Description = command.Description,
            EnableVersioning = command.EnableVersioning,
            EnableMinorVersions = command.EnableMinorVersions,
            RequireCheckout = command.RequireCheckout,
        };
        library.SetCreator(userId);

        db.Libraries.Add(library);
        await db.SaveChangesAsync(cancellationToken);
        return library.Id;
    }
}
