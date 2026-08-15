using MediatR;

namespace eDMS.Application.Folders.Commands.RenameFolder;

public sealed record RenameFolderCommand(Guid FolderId, string Name) : IRequest;
