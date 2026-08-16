using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.CreateContentType;

public sealed record CreateContentTypeCommand(string Name, string? Description, Guid? LibraryId)
    : IRequest<Guid>;

public sealed class CreateContentTypeHandler(
    IAppDbContext db,
    ICurrentUser currentUser) : IRequestHandler<CreateContentTypeCommand, Guid>
{
    public async Task<Guid> Handle(CreateContentTypeCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();

        var duplicate = await db.ContentTypes.AnyAsync(
            contentType => contentType.Name == command.Name
                && contentType.LibraryId == command.LibraryId,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A content type with this name already exists.");
        }

        var contentType = new ContentType
        {
            LibraryId = command.LibraryId,
            Name = command.Name,
            Description = command.Description,
        };
        contentType.SetCreator(userId);

        db.ContentTypes.Add(contentType);
        await db.SaveChangesAsync(cancellationToken);
        return contentType.Id;
    }
}
