using FluentValidation;

namespace eDMS.Application.Groups.Commands.CreateGroup;

public sealed class CreateGroupValidator : AbstractValidator<CreateGroupCommand>
{
    public CreateGroupValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
    }
}
