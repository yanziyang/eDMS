using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Documents.Commands.UpdateDocumentColumnValues;

public sealed record UpdateDocumentColumnValuesCommand(Guid DocumentId, IReadOnlyList<ColumnValueInput> Values)
    : IRequest, IAuthorizableRequest
{
    public ObjectType ObjectType => ObjectType.Document;
    public Guid ObjectId => DocumentId;
    public PermissionLevel RequiredLevel => PermissionLevel.Contribute;
}

public sealed class UpdateDocumentColumnValuesHandler(
    IAppDbContext db,
    ICurrentUser currentUser) : IRequestHandler<UpdateDocumentColumnValuesCommand>
{
    public async Task Handle(UpdateDocumentColumnValuesCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();

        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == command.DocumentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), command.DocumentId);

        if (document.ContentTypeId is not { } contentTypeId)
        {
            return;
        }

        var columns = await db.ColumnDefinitions.AsNoTracking()
            .Where(column => column.ContentTypeId == contentTypeId)
            .ToListAsync(cancellationToken);

        var existing = await db.DocumentColumnValues
            .Where(value => value.DocumentId == command.DocumentId)
            .ToListAsync(cancellationToken);
        db.DocumentColumnValues.RemoveRange(existing);

        foreach (var input in command.Values)
        {
            var column = columns.SingleOrDefault(item => item.Id == input.ColumnDefinitionId);
            if (column is null)
            {
                continue;
            }

            db.DocumentColumnValues.Add(new DocumentColumnValue
            {
                DocumentId = command.DocumentId,
                ColumnDefinitionId = input.ColumnDefinitionId,
                Value = input.Value ?? string.Empty,
            });
        }

        document.ModifiedBy = userId;
        document.ModifiedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}
