using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Notifications;
using eDMS.Domain;
using eDMS.Domain.Common;
using eDMS.Infrastructure.Notifications;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class NotificationServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _recipientId = Guid.NewGuid();
    private readonly Guid _documentId;
    private readonly FakeEmailSender _email = new();

    public NotificationServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var site = new Site { Name = "Notifications", UrlSlug = $"notifications-{Guid.NewGuid():N}"[..29] };
        site.SetCreator(_actorId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_actorId);
        var document = new Document
        {
            LibraryId = library.Id,
            Name = "Budget.docx",
            ContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        document.SetCreator(_actorId);

        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Documents.Add(document);
        _db.Users.AddRange(
            new ApplicationUser
            {
                Id = _actorId,
                UserName = "actor@edms.test",
                Email = "actor@edms.test",
                DisplayName = "Actor",
            },
            new ApplicationUser
            {
                Id = _recipientId,
                UserName = "recipient@edms.test",
                Email = "recipient@edms.test",
                DisplayName = "Recipient",
            });
        _db.SaveChanges();
        _documentId = document.Id;
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Follow_updates_frequency_without_duplicate_subscription()
    {
        var service = CreateService(_actorId);

        var first = await service.FollowAsync(ObjectType.Document, _documentId, AlertFrequency.Daily);
        var second = await service.FollowAsync(ObjectType.Document, _documentId, AlertFrequency.Weekly);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(AlertFrequency.Weekly, second.Frequency);
        Assert.Single(_db.AlertSubscriptions);
    }

    [Fact]
    public async Task Follow_rejects_non_followable_objects()
    {
        var service = CreateService(_actorId);

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.FollowAsync(ObjectType.User, Guid.NewGuid(), AlertFrequency.Immediate));
    }

    [Fact]
    public async Task Followed_change_creates_inbox_entry_and_sends_immediate_email()
    {
        var service = CreateService(_actorId);
        await CreateService(_recipientId).FollowAsync(
            ObjectType.Document,
            _documentId,
            AlertFrequency.Immediate);

        await service.PublishFollowedChangeAsync(ObjectType.Document, _documentId, "received a new version");

        var notification = Assert.Single(_db.Notifications);
        Assert.Equal(NotificationKind.FollowedItemChanged, notification.Kind);
        Assert.Equal("Budget.docx", notification.ObjectName);
        Assert.Equal("recipient@edms.test", _email.Sent.Single().To);
    }

    [Fact]
    public async Task Shared_item_creates_inbox_entry_and_sends_email()
    {
        var service = CreateService(_actorId);

        await service.PublishSharedAsync(
            _recipientId,
            ObjectType.Document,
            _documentId,
            "Budget.docx");

        var notification = Assert.Single(_db.Notifications);
        Assert.Equal(NotificationKind.SharedWithMe, notification.Kind);
        Assert.True(notification.EmailSentAt.HasValue);
        Assert.Equal("recipient@edms.test", _email.Sent.Single().To);
    }

    [Fact]
    public async Task Daily_digest_delivers_only_due_rows()
    {
        var notification = new Notification
        {
            UserId = _recipientId,
            Kind = NotificationKind.FollowedItemChanged,
            ObjectType = ObjectType.Document,
            ObjectId = _documentId,
            ObjectName = "Budget.docx",
            Message = "Budget.docx received a new version.",
            Frequency = AlertFrequency.Daily,
        };
        notification.SetCreator(_actorId);
        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        _db.Entry(notification).Property(nameof(AuditableEntity.CreatedAt)).CurrentValue =
            DateTimeOffset.UtcNow.AddDays(-2);
        await _db.SaveChangesAsync();

        var service = CreateService(_actorId);
        var delivered = await service.DeliverDigestsAsync();

        Assert.Equal(1, delivered);
        Assert.True(notification.EmailSentAt.HasValue);
        Assert.Contains(_email.Sent, message => message.Subject.Contains("daily", StringComparison.OrdinalIgnoreCase));
    }

    private NotificationService CreateService(Guid userId) => new(
        _db,
        new FakeCurrentUser(userId),
        new AllowAllResolver(),
        _email,
        TimeProvider.System);

    private sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => true;
        public string? Email => "actor@edms.test";
        public string? IpAddress => null;
        public string? ShareToken => null;
    }

    private sealed class AllowAllResolver : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(PermissionLevel.FullControl);

        public Task RequireAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            PermissionLevel required,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public List<(string To, string Subject, string Body)> Sent { get; } = [];

        public Task SendAsync(
            string to,
            string subject,
            string htmlBody,
            CancellationToken cancellationToken = default)
        {
            Sent.Add((to, subject, htmlBody));
            return Task.CompletedTask;
        }
    }
}
