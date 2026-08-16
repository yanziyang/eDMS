using FluentValidation;

namespace eDMS.Application.Admin.Commands.UpdateContentType;

public sealed class UpdateContentTypeValidator : AbstractValidator<UpdateContentTypeCommand>
{
    public UpdateContentTypeValidator()
    {
        RuleFor(command => command.ContentTypeId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
    }
}
