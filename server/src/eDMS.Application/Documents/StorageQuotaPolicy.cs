namespace eDMS.Application.Documents;

/// <summary>
/// Keeps the quota boundary calculation overflow-safe and consistent across all
/// operations that add bytes to a Site.
/// </summary>
public static class StorageQuotaPolicy
{
    public static bool WouldExceed(long usedBytes, long incomingBytes, long? quotaBytes)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(usedBytes);
        ArgumentOutOfRangeException.ThrowIfNegative(incomingBytes);

        if (quotaBytes is not { } quota)
        {
            return false;
        }

        if (quota < 0)
        {
            return true;
        }

        // Checking the difference instead of adding the two values avoids a
        // signed-long overflow at the boundary. Exactly the quota is allowed.
        return usedBytes > quota || incomingBytes > quota - usedBytes;
    }
}
