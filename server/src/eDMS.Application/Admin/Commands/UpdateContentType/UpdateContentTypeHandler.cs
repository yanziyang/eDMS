using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.UpdateContentType;

public sealed record UpdateContentTypeCommand(Guid ContentTypeId, string Name, string? Description, Guid? LibraryId)
    : IRequest;

public sealed class UpdateContentTypeHandler(IAppDbContext db) : IRequestHandler<UpdateContentTypeCommand>
{
    public async Task Handle(UpdateContentTypeCommand command, CancellationToken cancellationToken)
    {
        var contentType = await db.ContentTypes
            .SingleOrDefaultAsync(item => item.Id == command.ContentTypeId, cancellationToken)
            ?? throw new NotFoundException(nameof(ContentType), command.ContentTypeId);

        var duplicate = await db.ContentTypes.AnyAsync(
            item => item.Id != command.ContentTypeId
                && item.Name == command.Name
                && item.LibraryId == command.LibraryId,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A content type with this name already exists.");
        }

        contentType.Name = command.Name;
        contentType.Description = command.Description;
        contentType.LibraryId = command.LibraryId;
        await db.SaveChangesAsync(cancellationToken);
    }
}
