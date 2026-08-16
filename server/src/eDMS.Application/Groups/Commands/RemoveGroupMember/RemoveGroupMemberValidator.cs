using FluentValidation;
using MediatR;

namespace eDMS.Application.Groups.Commands.RemoveGroupMember;

public sealed class RemoveGroupMemberValidator : AbstractValidator<RemoveGroupMemberCommand>
{
    public RemoveGroupMemberValidator()
    {
        RuleFor(command => command.GroupId).NotEmpty();
        RuleFor(command => command.UserId).NotEmpty();
    }
}
