using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class AuthProviderTests
{
    public static IEnumerable<object[]> ValuesWithNumbers()
    {
        yield return [AuthProvider.Local, 0];
        yield return [AuthProvider.Saml, 1];
        yield return [AuthProvider.Oidc, 2];
    }

    [Theory]
    [MemberData(nameof(ValuesWithNumbers))]
    public void Values_round_trip_with_their_stored_numbers(AuthProvider value, int number)
    {
        Assert.Equal(number, (int)value);
        Assert.Equal(value, (AuthProvider)number);
        Assert.Equal(value, Enum.Parse<AuthProvider>(value.ToString()));
        Assert.Equal(value.ToString(), Enum.GetName(typeof(AuthProvider), value));
    }

    [Fact]
    public void Enum_has_exactly_the_expected_values()
    {
        Assert.Equal(3, Enum.GetValues<AuthProvider>().Length);
    }
}
