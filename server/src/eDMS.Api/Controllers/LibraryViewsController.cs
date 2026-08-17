using eDMS.Application.LibraryViews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/libraries/{libraryId:guid}/views")]
[Authorize]
public sealed class LibraryViewsController(ILibraryViewService views) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        Guid libraryId,
        CancellationToken cancellationToken) =>
        Ok(await views.ListAsync(libraryId, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(
        Guid libraryId,
        [FromBody] CreateLibraryViewRequest request,
        CancellationToken cancellationToken)
    {
        var view = await views.CreateAsync(libraryId, request, cancellationToken);
        return CreatedAtAction(nameof(List), new { libraryId }, view);
    }

    [HttpPut("{viewId:guid}")]
    public async Task<IActionResult> Update(
        Guid libraryId,
        Guid viewId,
        [FromBody] UpdateLibraryViewRequest request,
        CancellationToken cancellationToken)
    {
        await views.UpdateAsync(libraryId, viewId, request, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{viewId:guid}")]
    public async Task<IActionResult> Delete(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken)
    {
        await views.DeleteAsync(libraryId, viewId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{viewId:guid}/set-default")]
    public async Task<IActionResult> SetDefault(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken)
    {
        await views.SetDefaultAsync(libraryId, viewId, cancellationToken);
        return NoContent();
    }
}
