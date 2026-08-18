using FluentValidation;
using MediatR;

namespace eDMS.Application.Folders.Commands.CreateFolder;

public sealed class CreateFolderValidator : AbstractValidator<CreateFolderCommand>
{
    public CreateFolderValidator()
    {
        // LibraryId is required for root folder creation (bound from the route). For a
        // child folder the handler derives the library from its parent, so a client
        // sending only { name } to /folders/{parentId}/folders is valid (the frontend
        // does exactly this) and must not be rejected for omitting it.
        RuleFor(command => command.LibraryId).NotEmpty().When(command => command.ParentFolderId is null);
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
    }
}
