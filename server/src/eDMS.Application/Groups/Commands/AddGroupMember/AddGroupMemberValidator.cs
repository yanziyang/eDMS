using FluentValidation;
using MediatR;

namespace eDMS.Application.Groups.Commands.AddGroupMember;

public sealed class AddGroupMemberValidator : AbstractValidator<AddGroupMemberCommand>
{
    public AddGroupMemberValidator()
    {
        RuleFor(command => command.GroupId).NotEmpty();
        RuleFor(command => command.UserId).NotEmpty();
    }
}
