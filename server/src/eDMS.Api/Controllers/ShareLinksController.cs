using eDMS.Application.Sharing;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class ShareLinksController(IShareLinkService shareLinks) : ControllerBase
{
    [HttpPost("{objectType}/objects/{id:guid}/share-links")]
    public async Task<IActionResult> Create(
        ObjectType objectType,
        Guid id,
        [FromBody] CreateShareLinkRequest request,
        CancellationToken cancellationToken) =>
        Ok(await shareLinks.CreateAsync(objectType, id, request.Level, request.ExpiresAt, cancellationToken));

    [HttpGet("{objectType}/objects/{id:guid}/share-links")]
    public async Task<IActionResult> List(ObjectType objectType, Guid id, CancellationToken cancellationToken) =>
        Ok(await shareLinks.ListAsync(objectType, id, cancellationToken));

    [HttpDelete("share-links/{linkId:guid}")]
    public async Task<IActionResult> Revoke(Guid linkId, CancellationToken cancellationToken)
    {
        await shareLinks.RevokeAsync(linkId, cancellationToken);
        return NoContent();
    }
}

public sealed record CreateShareLinkRequest(PermissionLevel Level, DateTimeOffset? ExpiresAt);
