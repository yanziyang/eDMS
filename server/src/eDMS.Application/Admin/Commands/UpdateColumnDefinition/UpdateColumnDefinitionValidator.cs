using FluentValidation;

namespace eDMS.Application.Admin.Commands.UpdateColumnDefinition;

public sealed class UpdateColumnDefinitionValidator : AbstractValidator<UpdateColumnDefinitionCommand>
{
    public UpdateColumnDefinitionValidator()
    {
        RuleFor(command => command.ColumnDefinitionId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.ChoiceOptions).MaximumLength(4096);
        RuleFor(command => command.DefaultValue).MaximumLength(2048);
    }
}
