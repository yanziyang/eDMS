using System.Text.Json;
using eDMS.Application.Admin;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using eDMS.Application.Documents.Commands.UpdateDocumentColumnValues;
using eDMS.Application.Documents.Queries.GetDocumentMetadata;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class DocumentsController(
    IDocumentService documents,
    IMediator mediator,
    IOfficeConversionService officeConversion) : ControllerBase
{
    [HttpGet("libraries/{libraryId:guid}/items")]
    public async Task<IActionResult> ListLibraryItems(Guid libraryId, CancellationToken cancellationToken) =>
        Ok(await documents.ListAsync(libraryId, null, cancellationToken));

    [HttpPost("libraries/{libraryId:guid}/documents")]
    [RequestSizeLimit(262_144_000)]
    public async Task<IActionResult> UploadToLibrary(Guid libraryId, IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var result = await documents.UploadAsync(
            libraryId,
            null,
            file.FileName,
            stream,
            ParseMetadata(Request),
            cancellationToken);
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

    private static IReadOnlyList<ColumnValueInput>? ParseMetadata(HttpRequest request)
    {
        if (!request.HasFormContentType || !request.Form.TryGetValue("metadata", out var raw))
        {
            return null;
        }

        var value = raw.ToString();
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<List<ColumnValueInput>>(
                value,
                JsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            return null;
        }
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
        if (IsOfficeContentType(contentType))
        {
            var pdf = await officeConversion.ConvertToPdfAsync(fileName, stream, cancellationToken);
            if (pdf is not null)
            {
                return File(pdf, "application/pdf", fileName, enableRangeProcessing: true);
            }
        }

        return File(stream, contentType, fileName, enableRangeProcessing: true);
    }

    private static bool IsOfficeContentType(string contentType) =>
        contentType.Equals("application/msword", StringComparison.OrdinalIgnoreCase)
        || contentType.Equals("application/vnd.ms-excel", StringComparison.OrdinalIgnoreCase)
        || contentType.Equals("application/vnd.ms-powerpoint", StringComparison.OrdinalIgnoreCase)
        || contentType.StartsWith("application/vnd.openxmlformats-officedocument", StringComparison.OrdinalIgnoreCase);

    [HttpGet("documents/{id:guid}/metadata")]
    public async Task<IActionResult> Metadata(Guid id, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new GetDocumentMetadataQuery(id), cancellationToken));

    [HttpPut("documents/{id:guid}/metadata-values")]
    public async Task<IActionResult> UpdateMetadataValues(
        Guid id,
        [FromBody] UpdateMetadataValuesRequest request,
        CancellationToken cancellationToken)
    {
        await mediator.Send(new UpdateDocumentColumnValuesCommand(id, request.Values), cancellationToken);
        return NoContent();
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

    [HttpPost("documents/{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveCopyRequest request, CancellationToken cancellationToken)
    {
        var documentId = await documents.MoveAsync(
            id,
            request.DestinationLibraryId,
            request.DestinationFolderId,
            cancellationToken);
        return Ok(documentId);
    }

    [HttpPost("documents/{id:guid}/copy")]
    public async Task<IActionResult> Copy(Guid id, [FromBody] MoveCopyRequest request, CancellationToken cancellationToken)
    {
        var documentId = await documents.CopyAsync(
            id,
            request.DestinationLibraryId,
            request.DestinationFolderId,
            cancellationToken);
        return Ok(documentId);
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

public sealed record MoveCopyRequest(Guid DestinationLibraryId, Guid? DestinationFolderId);

public sealed record UpdateMetadataValuesRequest(IReadOnlyList<ColumnValueInput> Values);

public sealed record CheckinRequest(string? Comment);
