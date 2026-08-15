using eDMS.Application.Groups.Commands.AddGroupMember;
using eDMS.Application.Groups.Commands.CreateGroup;
using eDMS.Application.Groups.Commands.DeleteGroup;
using eDMS.Application.Groups.Commands.RemoveGroupMember;
using eDMS.Application.Groups.Queries.ListGroups;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/groups")]
[Authorize]
public sealed class GroupsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? siteId, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new ListGroupsQuery(siteId), cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGroupCommand command, CancellationToken cancellationToken)
    {
        var id = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(List), new { siteId = command.SiteId }, id);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteGroupCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> AddMember(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        await mediator.Send(new AddGroupMemberCommand(id, userId), cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        await mediator.Send(new RemoveGroupMemberCommand(id, userId), cancellationToken);
        return NoContent();
    }
}
