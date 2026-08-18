using System.Diagnostics;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Notifications;
using eDMS.Application.Recent;
using eDMS.Domain;
using eDMS.Infrastructure.Notifications;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Recent;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace eDMS.IntegrationTests;

/// <summary>
/// M31.5 performance sanity checks for the two Phase 4 query patterns most likely
/// to grow with user activity: the per-user Recent audit stream and followed-change
/// hierarchy fan-out. These are measurements, not benchmarks; the bounds are
/// intentionally generous so the tests catch pathological regressions without
/// making CI hardware part of the product contract.
/// </summary>
public sealed class Phase4PerformanceTests : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public Phase4PerformanceTests(ITestOutputHelper output)
    {
        _output = output;
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSnakeCaseNamingConvention()
            .UseSqlite(_connection)
            .Options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Recent_stays_within_bounds_with_a_realistic_audit_stream()
    {
        const int documentCount = 200;
        const int auditEntriesPerDocument = 5;
        const int totalAuditEntries = documentCount * auditEntriesPerDocument;
        const int iterations = 10;
        var userId = Guid.NewGuid();

        var site = new Site { Name = "Recent Perf", UrlSlug = "recent-perf" };
        site.SetCreator(userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(userId);
        _db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = "recent-perf@edms.test",
            Email = "recent-perf@edms.test",
        });
        _db.Sites.Add(site);
        _db.Libraries.Add(library);

        var documents = Enumerable.Range(0, documentCount)
            .Select(index =>
            {
                var document = new Document
                {
                    LibraryId = library.Id,
                    Name = $"recent-{index:D4}.txt",
                    ContentType = "text/plain",
                };
                document.SetCreator(userId);
                return document;
            })
            .ToList();
        _db.Documents.AddRange(documents);

        var now = DateTimeOffset.UtcNow;
        var auditEntries = documents
            .SelectMany((document, documentIndex) => Enumerable.Range(0, auditEntriesPerDocument)
                .Select(auditIndex => new AuditLogEntry
                {
                    Id = Guid.NewGuid(),
                    Timestamp = now.AddSeconds(-(documentIndex * auditEntriesPerDocument + auditIndex)),
                    UserId = userId,
                    Action = auditIndex switch
                    {
                        0 => AuditAction.View,
                        1 => AuditAction.Upload,
                        2 => AuditAction.EditMetadata,
                        _ => AuditAction.View,
                    },
                    ObjectType = ObjectType.Document,
                    ObjectId = document.Id,
                    ObjectName = document.Name,
                    SiteId = site.Id,
                }))
            .ToList();
        _db.AuditLogEntries.AddRange(auditEntries);
        await _db.SaveChangesAsync();

        var service = new RecentService(
            _db,
            new FixedCurrentUser(userId),
            new ReadPermissionResolver());

        var warmup = await service.ListAsync();
        Assert.Equal(20, warmup.Count);

        var stopwatch = Stopwatch.StartNew();
        for (var iteration = 0; iteration < iterations; iteration++)
        {
            var result = await service.ListAsync();
            Assert.Equal(20, result.Count);
        }
        stopwatch.Stop();

        var averageMs = stopwatch.Elapsed.TotalMilliseconds / iterations;
        _output.WriteLine(
            $"Recent query: {averageMs:F2} ms avg ({totalAuditEntries:N0} audit entries, "
            + $"{documentCount:N0} documents, {iterations} iterations)");
        Assert.True(
            averageMs < 500,
            $"Recent query too slow: {averageMs:F2} ms average with {totalAuditEntries:N0} audit entries");
    }

    [Fact]
    public async Task Follow_fan_out_stays_within_bounds_with_a_deep_hierarchy_and_many_subscribers()
    {
        const int folderDepth = 20;
        const int subscriberCount = 500;
        const int iterations = 5;
        var actorId = Guid.NewGuid();
        var site = new Site { Name = "Follow Perf", UrlSlug = "follow-perf" };
        site.SetCreator(actorId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(actorId);
        _db.Users.Add(new ApplicationUser
        {
            Id = actorId,
            UserName = "follow-perf-actor@edms.test",
            Email = "follow-perf-actor@edms.test",
        });
        _db.Sites.Add(site);
        _db.Libraries.Add(library);

        var parentFolderId = (Guid?)null;
        for (var depth = 0; depth < folderDepth; depth++)
        {
            var folder = new Folder
            {
                LibraryId = library.Id,
                ParentFolderId = parentFolderId,
                Name = $"Level {depth:D2}",
                Path = $"/{depth:D2}/",
            };
            folder.SetCreator(actorId);
            _db.Folders.Add(folder);
            parentFolderId = folder.Id;
        }

        var document = new Document
        {
            LibraryId = library.Id,
            FolderId = parentFolderId,
            Name = "followed.txt",
            ContentType = "text/plain",
        };
        document.SetCreator(actorId);
        _db.Documents.Add(document);

        var subscribers = Enumerable.Range(0, subscriberCount)
            .Select(_ => new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = $"follow-perf-{Guid.NewGuid():N}@edms.test",
                Email = $"follow-perf-{Guid.NewGuid():N}@edms.test",
            })
            .ToList();
        _db.Users.AddRange(subscribers);
        _db.AlertSubscriptions.AddRange(subscribers.Select((subscriber, index) =>
        {
            var subscription = new AlertSubscription
            {
                UserId = subscriber.Id,
                ObjectType = index % 2 == 0 ? ObjectType.Site : ObjectType.Library,
                ObjectId = index % 2 == 0 ? site.Id : library.Id,
                Frequency = AlertFrequency.Daily,
            };
            subscription.SetCreator(subscriber.Id);
            return subscription;
        }));
        await _db.SaveChangesAsync();

        var service = new NotificationService(
            _db,
            new FixedCurrentUser(actorId),
            new ReadPermissionResolver(),
            new NoOpEmailSender(),
            TimeProvider.System);

        await service.PublishFollowedChangeAsync(ObjectType.Document, document.Id, "was updated");
        Assert.Equal(subscriberCount, await _db.Notifications.CountAsync());
        await ClearNotificationsAsync();

        var measurements = new List<double>(iterations);
        for (var iteration = 0; iteration < iterations; iteration++)
        {
            var stopwatch = Stopwatch.StartNew();
            await service.PublishFollowedChangeAsync(ObjectType.Document, document.Id, "was updated");
            stopwatch.Stop();
            measurements.Add(stopwatch.Elapsed.TotalMilliseconds);
            Assert.Equal(subscriberCount, await _db.Notifications.CountAsync());
            if (iteration < iterations - 1)
            {
                await ClearNotificationsAsync();
            }
        }

        var averageMs = measurements.Average();
        _output.WriteLine(
            $"Follow fan-out: {averageMs:F2} ms avg ({folderDepth} folder levels, "
            + $"{subscriberCount:N0} subscriptions, {iterations} iterations)");
        Assert.True(
            averageMs < 5_000,
            $"Follow fan-out too slow: {averageMs:F2} ms average with {subscriberCount:N0} subscriptions");
    }

    private async Task ClearNotificationsAsync()
    {
        var notifications = await _db.Notifications.ToListAsync();
        _db.Notifications.RemoveRange(notifications);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
    }

    private sealed class FixedCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => false;
        public string? Email => null;
        public string? IpAddress => null;
        public string? ShareToken => null;
    }

    private sealed class ReadPermissionResolver : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(PermissionLevel.Read);

        public Task RequireAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            PermissionLevel required,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoOpEmailSender : IEmailSender
    {
        public Task SendAsync(
            string to,
            string subject,
            string htmlBody,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
