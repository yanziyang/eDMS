using eDMS.Application.Admin;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Queries.ListContentTypes;

public sealed record ListContentTypesQuery(Guid? LibraryId) : IRequest<IReadOnlyList<ContentTypeDto>>;

public sealed class ListContentTypesHandler(IAppDbContext db) : IRequestHandler<ListContentTypesQuery, IReadOnlyList<ContentTypeDto>>
{
    public async Task<IReadOnlyList<ContentTypeDto>> Handle(
        ListContentTypesQuery query,
        CancellationToken cancellationToken)
    {
        var contentTypes = await db.ContentTypes.AsNoTracking()
            .Where(contentType => query.LibraryId == null || contentType.LibraryId == query.LibraryId)
            .OrderBy(contentType => contentType.Name)
            .ToListAsync(cancellationToken);

        var columnDefinitions = await db.ColumnDefinitions.AsNoTracking()
            .Where(column => contentTypes.Select(contentType => contentType.Id).Contains(column.ContentTypeId))
            .OrderBy(column => column.Name)
            .ToListAsync(cancellationToken);

        return contentTypes.Select(contentType => new ContentTypeDto(
            contentType.Id,
            contentType.LibraryId,
            contentType.Name,
            contentType.Description,
            columnDefinitions
                .Where(column => column.ContentTypeId == contentType.Id)
                .Select(column => new ColumnDefinitionDto(
                    column.Id,
                    column.Name,
                    column.DataType,
                    column.IsRequired,
                    column.ChoiceOptions,
                    column.DefaultValue))
                .ToList())).ToList();
    }
}
