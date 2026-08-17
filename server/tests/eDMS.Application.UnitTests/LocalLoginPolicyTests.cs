using eDMS.Application.Auth;

namespace eDMS.Application.UnitTests;

public sealed class LocalLoginPolicyTests
{
    [Theory]
    [InlineData(false, false, false, true)]
    [InlineData(false, false, true, true)]
    [InlineData(false, true, false, false)]
    [InlineData(false, true, true, true)]
    [InlineData(true, false, false, false)]
    [InlineData(true, false, true, false)]
    [InlineData(true, true, false, false)]
    [InlineData(true, true, true, false)]
    public void CanUseLocalLogin_applies_all_flag_combinations(
        bool localLoginDisabled,
        bool ssoEnforcedGlobally,
        bool ssoExempt,
        bool expected)
    {
        Assert.Equal(
            expected,
            LocalLoginPolicy.CanUseLocalLogin(
                localLoginDisabled,
                ssoEnforcedGlobally,
                ssoExempt));
    }
}
