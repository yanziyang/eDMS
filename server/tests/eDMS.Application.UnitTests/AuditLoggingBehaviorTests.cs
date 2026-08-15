using eDMS.Application.Common.Behaviors;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace eDMS.Application.UnitTests;

public sealed class AuditLoggingBehaviorTests
{
    [Fact]
    public async Task Writes_audit_entry_after_successful_auditable_request()
    {
        var logger = new RecordingAuditLogger();
        var currentUser = new FixedCurrentUser(Guid.NewGuid());
        var behavior = new AuditLoggingBehavior<TestRequest, Unit>(
            logger,
            currentUser,
            NullLogger<AuditLoggingBehavior<TestRequest, Unit>>.Instance);

        await behavior.Handle(new TestRequest(), () => Task.FromResult(Unit.Value), default);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(AuditAction.Rename, entry.Action);
        Assert.Equal(ObjectType.Document, entry.ObjectType);
    }

    [Fact]
    public async Task Skips_audit_when_no_authenticated_user()
    {
        var logger = new RecordingAuditLogger();
        var currentUser = new FixedCurrentUser(null);
        var behavior = new AuditLoggingBehavior<TestRequest, Unit>(
            logger,
            currentUser,
            NullLogger<AuditLoggingBehavior<TestRequest, Unit>>.Instance);

        await behavior.Handle(new TestRequest(), () => Task.FromResult(Unit.Value), default);

        Assert.Empty(logger.Entries);
    }

    private sealed record TestRequest : IRequest<Unit>, IAuditableRequest
    {
        public AuditAction AuditAction => AuditAction.Rename;

        public ObjectType ObjectType => ObjectType.Document;

        public Guid ObjectId { get; } = Guid.NewGuid();

        public string ObjectName => "contract.pdf";

        public Guid? SiteId => null;
    }

    private sealed class FixedCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;

        public bool IsSystemAdmin => false;

        public string? Email => "user@edms.local";

        public string? IpAddress => "1.2.3.4";
    }

    private sealed class RecordingAuditLogger : IAuditLogger
    {
        public List<(AuditAction Action, ObjectType ObjectType)> Entries { get; } = [];

        public Task LogAsync(
            AuditAction action,
            ObjectType objectType,
            Guid objectId,
            string objectName,
            Guid? siteId,
            CancellationToken cancellationToken = default)
        {
            Entries.Add((action, objectType));
            return Task.CompletedTask;
        }

        public Task LogAuthAsync(
            Guid userId,
            AuditAction action,
            string objectName,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
