using eDMS.Application.Permissions;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class PermissionsController(IPermissionService permissions) : ControllerBase
{
    [HttpGet("{objectType}/objects/{id:guid}/permissions")]
    public async Task<IActionResult> Get(ObjectType objectType, Guid id, CancellationToken cancellationToken) =>
        Ok(await permissions.GetPermissionsAsync(objectType, id, cancellationToken));

    [HttpPost("{objectType}/objects/{id:guid}/permissions")]
    public async Task<IActionResult> Grant(
        ObjectType objectType,
        Guid id,
        [FromBody] GrantPermissionRequest request,
        CancellationToken cancellationToken)
    {
        await permissions.GrantAsync(objectType, id, request.PrincipalType, request.PrincipalId, request.Level, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{objectType}/objects/{id:guid}/permissions/{principalType}/{principalId:guid}")]
    public async Task<IActionResult> Revoke(
        ObjectType objectType,
        Guid id,
        PrincipalType principalType,
        Guid principalId,
        CancellationToken cancellationToken)
    {
        await permissions.RevokeAsync(objectType, id, principalType, principalId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{objectType}/objects/{id:guid}/permissions/reset")]
    public async Task<IActionResult> Reset(ObjectType objectType, Guid id, CancellationToken cancellationToken)
    {
        await permissions.ResetInheritanceAsync(objectType, id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{objectType}/objects/{id:guid}/share")]
    public async Task<IActionResult> Share(
        ObjectType objectType,
        Guid id,
        [FromBody] ShareRequest request,
        CancellationToken cancellationToken)
    {
        await permissions.ShareAsync(objectType, id, request.PrincipalId, request.Level, cancellationToken);
        return NoContent();
    }
}

public sealed record GrantPermissionRequest(PrincipalType PrincipalType, Guid PrincipalId, PermissionLevel Level);

public sealed record ShareRequest(Guid PrincipalId, PermissionLevel Level);
