using System.Security.Claims;
using eDMS.Application.Common.Interfaces;

namespace eDMS.Api.Auth;

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId => TryGetGuid(ClaimTypes.NameIdentifier);

    public bool IsSystemAdmin => accessor.HttpContext?.User.FindFirstValue("is_admin") == "true";

    public string? Email => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email);

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public string? ShareToken => accessor.HttpContext?.Request.Headers[ShareTokenHeader].ToString();

    public const string ShareTokenHeader = "X-Share-Token";

    private Guid? TryGetGuid(string claimType)
    {
        var value = accessor.HttpContext?.User.FindFirstValue(claimType);
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }
}
