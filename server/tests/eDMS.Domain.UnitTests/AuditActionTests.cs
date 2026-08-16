using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class AuditActionTests
{
    public static IEnumerable<object[]> RequiredActions()
    {
        yield return [AuditAction.Upload];
        yield return [AuditAction.Download];
        yield return [AuditAction.View];
        yield return [AuditAction.EditMetadata];
        yield return [AuditAction.Delete];
        yield return [AuditAction.Restore];
        yield return [AuditAction.Rename];
        yield return [AuditAction.Move];
        yield return [AuditAction.Copy];
        yield return [AuditAction.CheckOut];
        yield return [AuditAction.CheckIn];
        yield return [AuditAction.DiscardCheckout];
        yield return [AuditAction.PermissionChange];
        yield return [AuditAction.Share];
        yield return [AuditAction.Login];
        yield return [AuditAction.Logout];
    }

    [Theory]
    [MemberData(nameof(RequiredActions))]
    public void Audit_action_enum_contains_all_required_actions(AuditAction action)
    {
        Assert.True(Enum.IsDefined(action));
        Assert.Equal(action, (AuditAction)Enum.Parse(typeof(AuditAction), action.ToString()));
    }

    [Fact]
    public void Audit_action_values_are_contiguous_and_stable()
    {
        var values = Enum.GetValues<AuditAction>();

        Assert.Equal(16, values.Length);

        for (var i = 0; i < values.Length; i++)
        {
            Assert.Equal(i, (int)values[i]);
        }
    }
}
