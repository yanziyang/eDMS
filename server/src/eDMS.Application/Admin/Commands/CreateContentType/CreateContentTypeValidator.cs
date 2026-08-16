using FluentValidation;

namespace eDMS.Application.Admin.Commands.CreateContentType;

public sealed class CreateContentTypeValidator : AbstractValidator<CreateContentTypeCommand>
{
    public CreateContentTypeValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
    }
}
