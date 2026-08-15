using eDMS.Application.RecycleBin;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class RecycleBinController(IRecycleBinService recycleBin) : ControllerBase
{
    [HttpGet("sites/{siteId:guid}/recycle-bin")]
    public async Task<IActionResult> List(Guid siteId, CancellationToken cancellationToken) =>
        Ok(await recycleBin.ListAsync(siteId, cancellationToken));

    [HttpPost("recycle-bin/{itemId:guid}/restore")]
    public async Task<IActionResult> Restore([FromQuery] ObjectType objectType, Guid itemId, CancellationToken cancellationToken)
    {
        await recycleBin.RestoreAsync(objectType, itemId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("recycle-bin/{itemId:guid}")]
    public async Task<IActionResult> Delete([FromQuery] ObjectType objectType, Guid itemId, CancellationToken cancellationToken)
    {
        await recycleBin.PermanentlyDeleteAsync(objectType, itemId, cancellationToken);
        return NoContent();
    }
}
