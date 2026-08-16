using FluentValidation;

namespace eDMS.Application.Admin.Commands.AddColumnDefinition;

public sealed class AddColumnDefinitionValidator : AbstractValidator<AddColumnDefinitionCommand>
{
    public AddColumnDefinitionValidator()
    {
        RuleFor(command => command.ContentTypeId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.ChoiceOptions).MaximumLength(4096);
        RuleFor(command => command.DefaultValue).MaximumLength(2048);
    }
}
