using MediatR;

namespace eDMS.Application.Sites.Commands.CreateSite;

public sealed record CreateSiteCommand(string Name, string? Description, string UrlSlug)
    : IRequest<Guid>
{
}
