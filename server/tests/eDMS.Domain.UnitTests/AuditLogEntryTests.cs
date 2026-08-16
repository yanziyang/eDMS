using eDMS.Domain;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class AuditLogEntryTests
{
    [Fact]
    public void All_properties_round_trip()
    {
        var id = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var objectId = Guid.NewGuid();
        var siteId = Guid.NewGuid();
        var timestamp = new DateTimeOffset(2026, 4, 2, 11, 45, 0, TimeSpan.Zero);

        var entry = new AuditLogEntry
        {
            Id = id,
            Timestamp = timestamp,
            UserId = userId,
            Action = AuditAction.CheckIn,
            ObjectType = ObjectType.Document,
            ObjectId = objectId,
            ObjectName = "contract-2026.pdf",
            SiteId = siteId,
            Details = "Checked in minor version 1.1",
            IpAddress = "10.0.0.42",
        };

        Assert.Equal(id, entry.Id);
        Assert.Equal(timestamp, entry.Timestamp);
        Assert.Equal(userId, entry.UserId);
        Assert.Equal(AuditAction.CheckIn, entry.Action);
        Assert.Equal(ObjectType.Document, entry.ObjectType);
        Assert.Equal(objectId, entry.ObjectId);
        Assert.Equal("contract-2026.pdf", entry.ObjectName);
        Assert.Equal(siteId, entry.SiteId);
        Assert.Equal("Checked in minor version 1.1", entry.Details);
        Assert.Equal("10.0.0.42", entry.IpAddress);
    }

    [Fact]
    public void New_entry_has_safe_defaults()
    {
        var entry = new AuditLogEntry();

        Assert.Equal(Guid.Empty, entry.Id);
        Assert.Equal(Guid.Empty, entry.UserId);
        Assert.Equal(Guid.Empty, entry.ObjectId);
        Assert.Equal(string.Empty, entry.ObjectName);
        Assert.Null(entry.SiteId);
        Assert.Null(entry.Details);
        Assert.Null(entry.IpAddress);
    }
}
