using FluentValidation;
using MediatR;

namespace eDMS.Application.Folders.Commands.RenameFolder;

public sealed class RenameFolderValidator : AbstractValidator<RenameFolderCommand>
{
    public RenameFolderValidator()
    {
        RuleFor(command => command.FolderId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
    }
}
