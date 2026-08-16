using FluentValidation;

namespace eDMS.Application.Admin.Commands.DeleteColumnDefinition;

public sealed class DeleteColumnDefinitionValidator : AbstractValidator<DeleteColumnDefinitionCommand>
{
    public DeleteColumnDefinitionValidator()
    {
        RuleFor(command => command.ColumnDefinitionId).NotEmpty();
    }
}
