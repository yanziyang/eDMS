namespace eDMS.Application.Common.Exceptions;

public sealed class NotFoundException(string resource, object key)
    : Exception($"'{resource}' ({key}) was not found.");

public sealed class ForbiddenException(string? message = "You do not have permission to perform this action.")
    : Exception(message);

public sealed class ConflictException(string message) : Exception(message);

public sealed class SsoRequiredException(
    string message = "This account requires SSO authentication.") : Exception(message);

public sealed class SsoSafetyRailException(
    string message = "At least one active System Administrator must be SSO-exempt before global SSO enforcement can be enabled.")
    : Exception(message);
