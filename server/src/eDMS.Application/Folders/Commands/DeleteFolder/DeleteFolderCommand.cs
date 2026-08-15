using MediatR;

namespace eDMS.Application.Folders.Commands.DeleteFolder;

public sealed record DeleteFolderCommand(Guid FolderId) : IRequest;
