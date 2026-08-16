using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class PermissionLevelTests
{
    public static IEnumerable<object[]> ValuesWithNumbers()
    {
        yield return [PermissionLevel.FullControl, 0];
        yield return [PermissionLevel.Contribute, 1];
        yield return [PermissionLevel.Read, 2];
        yield return [PermissionLevel.NoAccess, 3];
    }

    [Theory]
    [MemberData(nameof(ValuesWithNumbers))]
    public void Values_round_trip_with_their_stored_numbers(PermissionLevel value, int number)
    {
        Assert.Equal(number, (int)value);
        Assert.Equal(value, (PermissionLevel)number);
        Assert.Equal(value, Enum.Parse<PermissionLevel>(value.ToString()));
        Assert.Equal(value.ToString(), Enum.GetName(typeof(PermissionLevel), value));
    }

    [Fact]
    public void Levels_are_ordered_from_strongest_to_weakest()
    {
        Assert.True(PermissionLevel.FullControl < PermissionLevel.Contribute);
        Assert.True(PermissionLevel.Contribute < PermissionLevel.Read);
        Assert.True(PermissionLevel.Read < PermissionLevel.NoAccess);
    }

    [Fact]
    public void Enum_has_exactly_the_expected_values()
    {
        Assert.Equal(4, Enum.GetValues<PermissionLevel>().Length);
    }
}
