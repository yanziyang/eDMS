using eDMS.Application.Libraries.Commands.CreateLibrary;
using eDMS.Application.Libraries.Commands.UpdateLibrary;
using eDMS.Application.Libraries.Queries.ListLibraries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/sites/{siteId:guid}/libraries")]
[Authorize]
public sealed class LibrariesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid siteId, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new ListLibrariesQuery(siteId), cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(Guid siteId, [FromBody] CreateLibraryCommand command, CancellationToken cancellationToken)
    {
        var id = await mediator.Send(command with { SiteId = siteId }, cancellationToken);
        return CreatedAtAction(nameof(List), new { siteId }, id);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLibraryCommand command, CancellationToken cancellationToken)
    {
        await mediator.Send(command with { LibraryId = id }, cancellationToken);
        return NoContent();
    }
}
