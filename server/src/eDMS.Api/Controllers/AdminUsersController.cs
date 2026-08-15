using eDMS.Application.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = "SystemAdmin")]
public sealed class AdminUsersController(IUserManagementService users) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken cancellationToken) =>
        Ok(await users.ListAsync(search, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var id = await users.CreateAsync(
            request.Email,
            request.DisplayName,
            request.TempPassword,
            request.IsSystemAdmin,
            cancellationToken);
        return CreatedAtAction(nameof(List), new { }, id);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        await users.UpdateAsync(id, request.DisplayName, request.IsSystemAdmin, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        await users.SetActiveAsync(id, false, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        await users.SetActiveAsync(id, true, cancellationToken);
        return NoContent();
    }
}

public sealed record CreateUserRequest(
    string Email,
    string DisplayName,
    string TempPassword,
    bool IsSystemAdmin);

public sealed record UpdateUserRequest(string DisplayName, bool IsSystemAdmin);
