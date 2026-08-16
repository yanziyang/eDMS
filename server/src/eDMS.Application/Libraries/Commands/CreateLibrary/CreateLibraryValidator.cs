using FluentValidation;
using MediatR;

namespace eDMS.Application.Libraries.Commands.CreateLibrary;

public sealed class CreateLibraryValidator : AbstractValidator<CreateLibraryCommand>
{
    public CreateLibraryValidator()
    {
        RuleFor(command => command.SiteId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
    }
}
