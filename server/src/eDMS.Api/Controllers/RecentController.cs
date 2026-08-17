using eDMS.Application.Recent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class RecentController(IRecentService recent) : ControllerBase
{
    [HttpGet("me/recent")]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await recent.ListAsync(cancellationToken));
}
