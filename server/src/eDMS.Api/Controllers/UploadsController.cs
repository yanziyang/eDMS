using eDMS.Application.Admin;
using eDMS.Application.Uploads;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/uploads")]
[Authorize]
public sealed class UploadsController(IChunkedUploadService uploads) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Start(
        [FromBody] StartUploadRequest request,
        CancellationToken cancellationToken) =>
        Ok(await uploads.StartAsync(request, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Status(Guid id, CancellationToken cancellationToken) =>
        Ok(await uploads.GetStatusAsync(id, cancellationToken));

    [HttpPut("{id:guid}/chunks")]
    public async Task<IActionResult> AppendChunk(
        Guid id,
        [FromQuery] long offset,
        CancellationToken cancellationToken)
    {
        await using var chunk = Request.Body;
        return Ok(await uploads.AppendChunkAsync(id, offset, chunk, cancellationToken));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(
        Guid id,
        [FromBody] CompleteUploadRequest? request,
        CancellationToken cancellationToken) =>
        Ok(await uploads.CompleteAsync(id, request?.Metadata, cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Abort(Guid id, CancellationToken cancellationToken)
    {
        await uploads.AbortAsync(id, cancellationToken);
        return NoContent();
    }
}

public sealed record CompleteUploadRequest(IReadOnlyList<ColumnValueInput>? Metadata);
