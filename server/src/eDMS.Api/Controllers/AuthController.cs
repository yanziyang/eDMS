using System.Security.Claims;
using eDMS.Api.Auth;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace eDMS.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await authService.LoginAsync(request, ipAddress, cancellationToken);

        if (result is null)
        {
            return Unauthorized();
        }

        RefreshTokenCookie.Append(
            Response,
            result.Tokens.RefreshToken,
            result.Tokens.RefreshTokenExpiresAt);

        return Ok(new LoginResponse(result.Tokens.AccessToken, result.ExpiresInSeconds, result.User));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshTokenCookie.Name];
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Unauthorized();
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var rotation = await authService.RefreshAsync(refreshToken, ipAddress, cancellationToken);

        if (rotation.Status != RefreshTokenRotationStatus.Success || rotation.TokenPair is null)
        {
            RefreshTokenCookie.Clear(Response);
            return Unauthorized();
        }

        RefreshTokenCookie.Append(
            Response,
            rotation.TokenPair.RefreshToken,
            rotation.TokenPair.RefreshTokenExpiresAt);

        return Ok(new RefreshResponse(rotation.TokenPair.AccessToken, rotation.ExpiresInSeconds));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshTokenCookie.Name];
        if (!string.IsNullOrEmpty(refreshToken))
        {
            await authService.RevokeRefreshTokenAsync(refreshToken, cancellationToken);
        }

        RefreshTokenCookie.Clear(Response);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        var user = await authService.GetCurrentUserAsync(userId, cancellationToken);
        return user is null ? Unauthorized() : Ok(user);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await authService.RequestPasswordResetAsync(request.Email, cancellationToken);
        return Ok();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var success = await authService.ResetPasswordAsync(
            request.Email,
            request.Token,
            request.NewPassword,
            cancellationToken);

        return success ? Ok() : BadRequest();
    }

}
