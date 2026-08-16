using eDMS.Application.Sites.Commands.CreateSite;
using eDMS.Application.Sites.Commands.DeleteSite;
using eDMS.Application.Sites.Commands.UpdateSite;
using eDMS.Application.Sites.Queries.GetSite;
using eDMS.Application.Sites.Queries.ListSites;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/sites")]
[Authorize]
public sealed class SitesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new ListSitesQuery(), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new GetSiteQuery(id), cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSiteCommand command, CancellationToken cancellationToken)
    {
        var id = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id }, id);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSiteCommand command, CancellationToken cancellationToken)
    {
        await mediator.Send(command with { SiteId = id }, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteSiteCommand(id), cancellationToken);
        return NoContent();
    }
}
