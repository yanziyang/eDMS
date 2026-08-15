using MediatR;

namespace eDMS.Application.Folders.Commands.CreateFolder;

public sealed record CreateFolderCommand(Guid LibraryId, Guid? ParentFolderId, string Name) : IRequest<Guid>;
