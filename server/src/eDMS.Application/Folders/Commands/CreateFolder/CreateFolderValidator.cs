using FluentValidation;
using MediatR;

namespace eDMS.Application.Folders.Commands.CreateFolder;

public sealed class CreateFolderValidator : AbstractValidator<CreateFolderCommand>
{
    public CreateFolderValidator()
    {
        RuleFor(command => command.LibraryId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
    }
}
