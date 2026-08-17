using eDMS.Application.Favorites;
using eDMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public sealed class FavoritesController(IFavoritesService favorites) : ControllerBase
{
    [HttpPost("{objectType}/objects/{id:guid}/favorite")]
    public async Task<IActionResult> Add(
        ObjectType objectType,
        Guid id,
        CancellationToken cancellationToken)
    {
        await favorites.AddAsync(objectType, id, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{objectType}/objects/{id:guid}/favorite")]
    public async Task<IActionResult> Remove(
        ObjectType objectType,
        Guid id,
        CancellationToken cancellationToken)
    {
        await favorites.RemoveAsync(objectType, id, cancellationToken);
        return NoContent();
    }

    [HttpGet("me/favorites")]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await favorites.ListAsync(cancellationToken));
}
