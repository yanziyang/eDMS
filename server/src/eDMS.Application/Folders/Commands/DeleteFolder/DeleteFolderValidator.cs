using FluentValidation;
using MediatR;

namespace eDMS.Application.Folders.Commands.DeleteFolder;

public sealed class DeleteFolderValidator : AbstractValidator<DeleteFolderCommand>
{
    public DeleteFolderValidator()
    {
        RuleFor(command => command.FolderId).NotEmpty();
    }
}
