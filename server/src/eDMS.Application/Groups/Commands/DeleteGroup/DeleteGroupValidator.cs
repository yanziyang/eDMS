using FluentValidation;
using MediatR;

namespace eDMS.Application.Groups.Commands.DeleteGroup;

public sealed class DeleteGroupValidator : AbstractValidator<DeleteGroupCommand>
{
    public DeleteGroupValidator()
    {
        RuleFor(command => command.GroupId).NotEmpty();
    }
}
