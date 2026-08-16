using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Libraries.Commands.UpdateLibrary;

public sealed record UpdateLibraryCommand(
    Guid LibraryId,
    string Name,
    string? Description,
    bool EnableVersioning,
    bool EnableMinorVersions,
    bool RequireCheckout,
    int? MinorVersionsRetained) : IRequest, IAuthorizableRequest
{
    public ObjectType ObjectType => ObjectType.Library;
    public Guid ObjectId => LibraryId;
    public PermissionLevel RequiredLevel => PermissionLevel.Contribute;
}

public sealed class UpdateLibraryHandler(IAppDbContext db) : IRequestHandler<UpdateLibraryCommand>
{
    public async Task Handle(UpdateLibraryCommand command, CancellationToken cancellationToken)
    {
        var library = await db.Libraries.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == command.LibraryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Library), command.LibraryId);

        library.Name = command.Name;
        library.Description = command.Description;
        library.EnableVersioning = command.EnableVersioning;
        library.EnableMinorVersions = command.EnableMinorVersions;
        library.RequireCheckout = command.RequireCheckout;
        library.MinorVersionsRetained = command.MinorVersionsRetained;
        await db.SaveChangesAsync(cancellationToken);
    }
}
