namespace eDMS.Api.Auth;

public static class RefreshTokenCookie
{
    public const string Name = "edms_refresh";

    private const string Path = "/api/v1/auth";

    public static void Append(HttpResponse response, string token, DateTimeOffset expiresAt)
    {
        response.Cookies.Append(Name, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = response.HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = Path,
            Expires = expiresAt.UtcDateTime,
        });
    }

    public static void Clear(HttpResponse response)
    {
        response.Cookies.Delete(Name, new CookieOptions { Path = Path });
    }
}
