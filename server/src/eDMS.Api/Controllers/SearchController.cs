using eDMS.Application.Search;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/search")]
[Authorize]
public sealed class SearchController(ISearchService search) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] Guid? siteId,
        [FromQuery] Guid? libraryId,
        CancellationToken cancellationToken) =>
        Ok(await search.SearchAsync(q, siteId, libraryId, cancellationToken));
}
