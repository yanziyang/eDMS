using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class SiteRoleTests
{
    public static IEnumerable<object[]> ValuesWithNumbers()
    {
        yield return [SiteRole.Owner, 0];
        yield return [SiteRole.Member, 1];
        yield return [SiteRole.Visitor, 2];
    }

    [Theory]
    [MemberData(nameof(ValuesWithNumbers))]
    public void Values_round_trip_with_their_stored_numbers(SiteRole value, int number)
    {
        Assert.Equal(number, (int)value);
        Assert.Equal(value, (SiteRole)number);
        Assert.Equal(value, Enum.Parse<SiteRole>(value.ToString()));
        Assert.Equal(value.ToString(), Enum.GetName(typeof(SiteRole), value));
    }

    [Fact]
    public void Enum_has_exactly_the_expected_values()
    {
        Assert.Equal(3, Enum.GetValues<SiteRole>().Length);
    }
}
