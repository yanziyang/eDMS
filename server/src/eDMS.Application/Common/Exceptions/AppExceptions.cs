namespace eDMS.Application.Common.Exceptions;

public sealed class NotFoundException(string resource, object key)
    : Exception($"'{resource}' ({key}) was not found.");

public sealed class ForbiddenException(string? message = "You do not have permission to perform this action.")
    : Exception(message);

public sealed class ConflictException(string message) : Exception(message);

public sealed class QuotaExceededException(
    string siteName,
    long quotaBytes,
    long usedBytes,
    long incomingBytes)
    : Exception(
        $"Site '{siteName}' has a storage quota of {quotaBytes:N0} bytes. " +
        $"This operation would use {(usedBytes > long.MaxValue - incomingBytes ? long.MaxValue : usedBytes + incomingBytes):N0} bytes.")
{
    public string SiteName { get; } = siteName;

    public long QuotaBytes { get; } = quotaBytes;

    public long UsedBytes { get; } = usedBytes;

    public long IncomingBytes { get; } = incomingBytes;
}

public sealed class SsoRequiredException(
    string message = "This account requires SSO authentication.") : Exception(message);

public sealed class SsoSafetyRailException(
    string message = "At least one active System Administrator must be SSO-exempt before global SSO enforcement can be enabled.")
    : Exception(message);
