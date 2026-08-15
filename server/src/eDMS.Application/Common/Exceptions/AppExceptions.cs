namespace eDMS.Application.Common.Exceptions;

public sealed class NotFoundException(string resource, object key)
    : Exception($"'{resource}' ({key}) was not found.");

public sealed class ForbiddenException(string? message = "You do not have permission to perform this action.")
    : Exception(message);

public sealed class ConflictException(string message) : Exception(message);
