using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Libraries.Queries.ListLibraries;

public sealed class ListLibrariesHandler(IAppDbContext db) : IRequestHandler<ListLibrariesQuery, IReadOnlyList<LibraryDto>>
{
    public async Task<IReadOnlyList<LibraryDto>> Handle(ListLibrariesQuery query, CancellationToken cancellationToken)
    {
        var libraries = await db.Libraries.AsNoTracking()
            .Where(library => library.SiteId == query.SiteId)
            .OrderBy(library => library.Name)
            .ToListAsync(cancellationToken);

        return libraries.Select(library => new LibraryDto(
            library.Id,
            library.SiteId,
            library.Name,
            library.Description,
            library.EnableVersioning,
            library.EnableMinorVersions,
            library.RequireCheckout)).ToList();
    }
}
