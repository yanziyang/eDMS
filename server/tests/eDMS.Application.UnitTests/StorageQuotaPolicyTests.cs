using eDMS.Application.Documents;

namespace eDMS.Application.UnitTests;

public sealed class StorageQuotaPolicyTests
{
    [Fact]
    public void Exactly_at_quota_is_allowed()
    {
        Assert.False(StorageQuotaPolicy.WouldExceed(9, 1, 10));
    }

    [Fact]
    public void One_byte_over_quota_is_rejected()
    {
        Assert.True(StorageQuotaPolicy.WouldExceed(9, 2, 10));
    }

    [Fact]
    public void Null_quota_is_unlimited_even_at_long_max_value()
    {
        Assert.False(StorageQuotaPolicy.WouldExceed(long.MaxValue, long.MaxValue, null));
    }

    [Fact]
    public void Boundary_calculation_does_not_overflow()
    {
        Assert.True(StorageQuotaPolicy.WouldExceed(long.MaxValue - 1, 2, long.MaxValue));
    }
}
