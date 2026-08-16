using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.DeleteContentType;

public sealed record DeleteContentTypeCommand(Guid ContentTypeId) : IRequest;

public sealed class DeleteContentTypeHandler(IAppDbContext db) : IRequestHandler<DeleteContentTypeCommand>
{
    public async Task Handle(DeleteContentTypeCommand command, CancellationToken cancellationToken)
    {
        var contentType = await db.ContentTypes
            .SingleOrDefaultAsync(item => item.Id == command.ContentTypeId, cancellationToken)
            ?? throw new NotFoundException(nameof(ContentType), command.ContentTypeId);

        var inUse = await db.Documents.AnyAsync(
            document => document.ContentTypeId == command.ContentTypeId,
            cancellationToken);
        if (inUse)
        {
            throw new ConflictException("This content type is in use by documents and cannot be deleted.");
        }

        db.ContentTypes.Remove(contentType);
        await db.SaveChangesAsync(cancellationToken);
    }
}
