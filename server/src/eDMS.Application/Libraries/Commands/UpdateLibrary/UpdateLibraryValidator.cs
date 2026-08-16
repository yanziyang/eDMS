using FluentValidation;

namespace eDMS.Application.Libraries.Commands.UpdateLibrary;

public sealed class UpdateLibraryValidator : AbstractValidator<UpdateLibraryCommand>
{
    public UpdateLibraryValidator()
    {
        RuleFor(command => command.LibraryId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
        RuleFor(command => command.MinorVersionsRetained).GreaterThan(0).When(command => command.MinorVersionsRetained is not null);
    }
}
