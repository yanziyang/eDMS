using FluentValidation;

namespace eDMS.Application.Documents.Commands.UpdateDocumentColumnValues;

public sealed class UpdateDocumentColumnValuesValidator : AbstractValidator<UpdateDocumentColumnValuesCommand>
{
    public UpdateDocumentColumnValuesValidator()
    {
        RuleFor(command => command.DocumentId).NotEmpty();
        RuleFor(command => command.Values).NotNull();
        RuleForEach(command => command.Values)
            .ChildRules(values =>
            {
                values.RuleFor(input => input.ColumnDefinitionId).NotEmpty();
                values.RuleFor(input => input.Value).MaximumLength(4096);
            });
    }
}
