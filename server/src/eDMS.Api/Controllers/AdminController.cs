using eDMS.Application.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize(Policy = "SystemAdmin")]
public sealed class AdminController(IAdminService admin) : ControllerBase
{
    [HttpGet("sites/{siteId:guid}/audit-log")]
    public async Task<IActionResult> AuditLog(Guid siteId, CancellationToken cancellationToken) =>
        Ok(await admin.ListAuditLogAsync(siteId, cancellationToken));

    [HttpGet("admin/storage")]
    public async Task<IActionResult> Storage(CancellationToken cancellationToken) =>
        Ok(await admin.GetStorageReportAsync(cancellationToken));

    [HttpGet("admin/settings")]
    public async Task<IActionResult> Settings(CancellationToken cancellationToken) =>
        Ok(await admin.GetSettingsAsync(cancellationToken));
}
