using eDMS.Application.Admin;
using eDMS.Application.Admin.Commands.AddColumnDefinition;
using eDMS.Application.Admin.Commands.CreateContentType;
using eDMS.Application.Admin.Commands.DeleteColumnDefinition;
using eDMS.Application.Admin.Commands.DeleteContentType;
using eDMS.Application.Admin.Commands.UpdateColumnDefinition;
using eDMS.Application.Admin.Commands.UpdateContentType;
using eDMS.Application.Admin.Queries.ListContentTypes;
using eDMS.Domain;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize(Policy = "SystemAdmin")]
public sealed class AdminController(IAdminService admin, IMediator mediator) : ControllerBase
{
    [HttpGet("sites/{siteId:guid}/audit-log")]
    public async Task<IActionResult> AuditLog(Guid siteId, CancellationToken cancellationToken) =>
        Ok(await admin.ListAuditLogAsync(siteId, cancellationToken));

    [HttpGet("admin/storage")]
    public async Task<IActionResult> Storage(CancellationToken cancellationToken) =>
        Ok(await admin.GetStorageReportAsync(cancellationToken));

    [HttpGet("admin/settings")]
    public async Task<IActionResult> Settings(CancellationToken cancellationToken) =>
        Ok(await admin.GetSettingsAsync(cancellationToken));

    [HttpPut("admin/settings")]
    public async Task<IActionResult> UpdateSettings(
        [FromBody] UpdateAdminSettingsRequest request,
        CancellationToken cancellationToken)
    {
        await admin.UpdateSettingsAsync(request, cancellationToken);
        return NoContent();
    }

    [HttpGet("admin/content-types")]
    public async Task<IActionResult> ContentTypes([FromQuery] Guid? libraryId, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new ListContentTypesQuery(libraryId), cancellationToken));

    [HttpPost("admin/content-types")]
    public async Task<IActionResult> CreateContentType(
        [FromBody] CreateContentTypeCommand command,
        CancellationToken cancellationToken)
    {
        var id = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(ContentTypes), new { }, id);
    }

    [HttpPut("admin/content-types/{id:guid}")]
    public async Task<IActionResult> UpdateContentType(
        Guid id,
        [FromBody] UpdateContentTypeCommand command,
        CancellationToken cancellationToken)
    {
        await mediator.Send(command with { ContentTypeId = id }, cancellationToken);
        return NoContent();
    }

    [HttpDelete("admin/content-types/{id:guid}")]
    public async Task<IActionResult> DeleteContentType(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteContentTypeCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("admin/content-types/{id:guid}/columns")]
    public async Task<IActionResult> AddColumn(
        Guid id,
        [FromBody] AddColumnDefinitionCommand command,
        CancellationToken cancellationToken)
    {
        var columnId = await mediator.Send(command with { ContentTypeId = id }, cancellationToken);
        return CreatedAtAction(nameof(ContentTypes), new { }, columnId);
    }

    [HttpPut("admin/columns/{id:guid}")]
    public async Task<IActionResult> UpdateColumn(
        Guid id,
        [FromBody] UpdateColumnDefinitionCommand command,
        CancellationToken cancellationToken)
    {
        await mediator.Send(command with { ColumnDefinitionId = id }, cancellationToken);
        return NoContent();
    }

    [HttpDelete("admin/columns/{id:guid}")]
    public async Task<IActionResult> DeleteColumn(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteColumnDefinitionCommand(id), cancellationToken);
        return NoContent();
    }
}
