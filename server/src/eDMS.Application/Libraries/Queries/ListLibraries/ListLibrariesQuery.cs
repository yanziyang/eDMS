using eDMS.Application.Documents;
using MediatR;

namespace eDMS.Application.Libraries.Queries.ListLibraries;

public sealed record ListLibrariesQuery(Guid SiteId) : IRequest<IReadOnlyList<LibraryDto>>;
