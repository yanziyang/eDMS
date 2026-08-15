namespace eDMS.Application.Common;

/// <summary>
/// Marks a request that is legitimately public (login, forgot/reset password) so the
/// <c>AuthorizationBehavior</c> skips the permission check for it.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class AllowAnonymousCheckAttribute : Attribute
{
}
