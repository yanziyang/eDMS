using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Documents.Queries.GetDocumentMetadata;

public sealed record GetDocumentMetadataQuery(Guid DocumentId)
    : IRequest<DocumentMetadataDto>, IAuthorizableRequest
{
    public ObjectType ObjectType => ObjectType.Document;
    public Guid ObjectId => DocumentId;
    public PermissionLevel RequiredLevel => PermissionLevel.Read;
}

public sealed class GetDocumentMetadataHandler(IAppDbContext db) : IRequestHandler<GetDocumentMetadataQuery, DocumentMetadataDto>
{
    public async Task<DocumentMetadataDto> Handle(
        GetDocumentMetadataQuery query,
        CancellationToken cancellationToken)
    {
        var document = await db.Documents.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == query.DocumentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Document), query.DocumentId);

        if (document.ContentTypeId is not { } contentTypeId)
        {
            return new DocumentMetadataDto(null, null, []);
        }

        var contentType = await db.ContentTypes.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == contentTypeId, cancellationToken);

        var columns = await db.ColumnDefinitions.AsNoTracking()
            .Where(column => column.ContentTypeId == contentTypeId)
            .OrderBy(column => column.Name)
            .ToListAsync(cancellationToken);

        var values = await db.DocumentColumnValues.AsNoTracking()
            .Where(value => value.DocumentId == query.DocumentId)
            .ToDictionaryAsync(value => value.ColumnDefinitionId, value => value.Value, cancellationToken);

        return new DocumentMetadataDto(
            contentTypeId,
            contentType?.Name,
            columns.Select(column => new DocumentMetadataColumnDto(
                column.Id,
                column.Name,
                column.DataType,
                column.IsRequired,
                column.ChoiceOptions,
                column.DefaultValue,
                values.GetValueOrDefault(column.Id))).ToList());
    }
}
