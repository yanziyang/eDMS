using eDMS.Application.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class DocumentsController(IDocumentService documents) : ControllerBase
{
    [HttpGet("libraries/{libraryId:guid}/items")]
    public async Task<IActionResult> ListLibraryItems(Guid libraryId, CancellationToken cancellationToken) =>
        Ok(await documents.ListAsync(libraryId, null, cancellationToken));

    [HttpPost("libraries/{libraryId:guid}/documents")]
    [RequestSizeLimit(262_144_000)]
    public async Task<IActionResult> UploadToLibrary(Guid libraryId, IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var result = await documents.UploadAsync(libraryId, null, file.FileName, stream, cancellationToken);
        return Ok(result);
    }

    [HttpPost("folders/{folderId:guid}/documents")]
    [RequestSizeLimit(262_144_000)]
    public async Task<IActionResult> UploadToFolder(Guid folderId, IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var result = await documents.UploadToFolderAsync(folderId, file.FileName, stream, cancellationToken);
        return Ok(result);
    }

    [HttpGet("documents/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await documents.GetAsync(id, cancellationToken));

    [HttpGet("documents/{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var (stream, fileName, contentType) = await documents.DownloadAsync(id, cancellationToken);
        return File(stream, contentType, fileName);
    }

    [HttpGet("documents/{id:guid}/preview")]
    public async Task<IActionResult> Preview(Guid id, CancellationToken cancellationToken)
    {
        var (stream, fileName, contentType) = await documents.DownloadAsync(id, cancellationToken);
        return File(stream, contentType, fileName, enableRangeProcessing: true);
    }

    [HttpDelete("documents/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await documents.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPut("documents/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDocumentRequest request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            await documents.RenameAsync(id, request.Name, cancellationToken);
        }
        else
        {
            await documents.UpdateMetadataAsync(id, request.Title, request.Description, cancellationToken);
        }

        return NoContent();
    }

    [HttpGet("documents/{id:guid}/versions")]
    public async Task<IActionResult> Versions(Guid id, CancellationToken cancellationToken) =>
        Ok(await documents.ListVersionsAsync(id, cancellationToken));

    [HttpPost("documents/{id:guid}/versions/{versionId:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, Guid versionId, CancellationToken cancellationToken)
    {
        await documents.RestoreVersionAsync(id, versionId, cancellationToken);
        return NoContent();
    }

    [HttpPost("documents/{id:guid}/checkout")]
    public async Task<IActionResult> Checkout(Guid id, CancellationToken cancellationToken)
    {
        await documents.CheckOutAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("documents/{id:guid}/checkin")]
    public async Task<IActionResult> Checkin(Guid id, [FromBody] CheckinRequest? request, CancellationToken cancellationToken)
    {
        await documents.CheckInAsync(id, request?.Comment, cancellationToken);
        return NoContent();
    }

    [HttpPost("documents/{id:guid}/discard-checkout")]
    public async Task<IActionResult> DiscardCheckout(Guid id, CancellationToken cancellationToken)
    {
        await documents.DiscardCheckoutAsync(id, cancellationToken);
        return NoContent();
    }

}

public sealed record UpdateDocumentRequest(string? Name, string? Title, string? Description);

public sealed record CheckinRequest(string? Comment);
