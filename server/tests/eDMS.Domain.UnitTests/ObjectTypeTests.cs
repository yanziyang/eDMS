using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class ObjectTypeTests
{
    public static IEnumerable<object[]> ValuesWithNumbers()
    {
        yield return [ObjectType.Site, 0];
        yield return [ObjectType.Library, 1];
        yield return [ObjectType.Folder, 2];
        yield return [ObjectType.Document, 3];
        yield return [ObjectType.User, 4];
    }

    [Theory]
    [MemberData(nameof(ValuesWithNumbers))]
    public void Values_round_trip_with_their_stored_numbers(ObjectType value, int number)
    {
        Assert.Equal(number, (int)value);
        Assert.Equal(value, (ObjectType)number);
        Assert.Equal(value, Enum.Parse<ObjectType>(value.ToString()));
        Assert.Equal(value.ToString(), Enum.GetName(typeof(ObjectType), value));
    }

    [Fact]
    public void Enum_has_exactly_the_expected_values()
    {
        Assert.Equal(5, Enum.GetValues<ObjectType>().Length);
    }
}
