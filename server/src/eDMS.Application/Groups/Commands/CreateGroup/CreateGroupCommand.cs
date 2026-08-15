using MediatR;

namespace eDMS.Application.Groups.Commands.CreateGroup;

public sealed record CreateGroupCommand(string Name, string? Description, Guid? SiteId) : IRequest<Guid>;
