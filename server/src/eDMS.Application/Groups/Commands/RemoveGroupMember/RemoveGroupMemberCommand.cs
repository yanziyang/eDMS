using MediatR;

namespace eDMS.Application.Groups.Commands.RemoveGroupMember;

public sealed record RemoveGroupMemberCommand(Guid GroupId, Guid UserId) : IRequest;
