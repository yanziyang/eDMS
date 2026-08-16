using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class PrincipalTypeTests
{
    public static IEnumerable<object[]> ValuesWithNumbers()
    {
        yield return [PrincipalType.User, 0];
        yield return [PrincipalType.Group, 1];
    }

    [Theory]
    [MemberData(nameof(ValuesWithNumbers))]
    public void Values_round_trip_with_their_stored_numbers(PrincipalType value, int number)
    {
        Assert.Equal(number, (int)value);
        Assert.Equal(value, (PrincipalType)number);
        Assert.Equal(value, Enum.Parse<PrincipalType>(value.ToString()));
        Assert.Equal(value.ToString(), Enum.GetName(typeof(PrincipalType), value));
    }

    [Fact]
    public void Enum_has_exactly_the_expected_values()
    {
        Assert.Equal(2, Enum.GetValues<PrincipalType>().Length);
    }
}
