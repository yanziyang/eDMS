using FluentValidation;

namespace eDMS.Application.Admin.Commands.DeleteContentType;

public sealed class DeleteContentTypeValidator : AbstractValidator<DeleteContentTypeCommand>
{
    public DeleteContentTypeValidator()
    {
        RuleFor(command => command.ContentTypeId).NotEmpty();
    }
}
