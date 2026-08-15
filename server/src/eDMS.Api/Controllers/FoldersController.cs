using eDMS.Application.Folders.Commands.CreateFolder;
using eDMS.Application.Folders.Commands.DeleteFolder;
using eDMS.Application.Folders.Commands.RenameFolder;
using eDMS.Application.Documents;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Authorize]
public sealed class FoldersController(IMediator mediator, IDocumentService documents) : ControllerBase
{
    [HttpPost("api/v1/libraries/{libraryId:guid}/folders")]
    public async Task<IActionResult> CreateRoot(Guid libraryId, [FromBody] CreateFolderCommand command, CancellationToken cancellationToken)
    {
        var id = await mediator.Send(command with { LibraryId = libraryId }, cancellationToken);
        return CreatedAtAction(nameof(List), new { id }, id);
    }

    [HttpPost("api/v1/folders/{id:guid}/folders")]
    public async Task<IActionResult> CreateChild(Guid id, [FromBody] CreateFolderCommand command, CancellationToken cancellationToken)
    {
        var folderId = await mediator.Send(command with { ParentFolderId = id }, cancellationToken);
        return CreatedAtAction(nameof(List), new { id = folderId }, folderId);
    }

    [HttpGet("api/v1/folders/{id:guid}/items")]
    public async Task<IActionResult> List(Guid id, CancellationToken cancellationToken) =>
        Ok(await documents.ListFolderAsync(id, cancellationToken));

    [HttpPut("api/v1/folders/{id:guid}")]
    public async Task<IActionResult> Rename(Guid id, [FromBody] RenameFolderCommand command, CancellationToken cancellationToken)
    {
        await mediator.Send(command with { FolderId = id }, cancellationToken);
        return NoContent();
    }

    [HttpDelete("api/v1/folders/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteFolderCommand(id), cancellationToken);
        return NoContent();
    }
}
