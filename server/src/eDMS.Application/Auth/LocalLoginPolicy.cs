namespace eDMS.Application.Auth;

public static class LocalLoginPolicy
{
    public static bool CanUseLocalLogin(
        bool localLoginDisabled,
        bool ssoEnforcedGlobally,
        bool ssoExempt) =>
        !localLoginDisabled && (!ssoEnforcedGlobally || ssoExempt);
}
