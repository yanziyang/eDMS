using MediatR;

namespace eDMS.Application.Libraries.Commands.CreateLibrary;

public sealed record CreateLibraryCommand(
    Guid SiteId,
    string Name,
    string? Description,
    bool EnableVersioning = true,
    bool EnableMinorVersions = false,
    bool RequireCheckout = false) : IRequest<Guid>;
