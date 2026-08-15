using MediatR;

namespace eDMS.Application.Groups.Commands.AddGroupMember;

public sealed record AddGroupMemberCommand(Guid GroupId, Guid UserId) : IRequest;
