using System.Diagnostics;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit.Abstractions;

namespace eDMS.IntegrationTests;

/// <summary>
/// Measures the recursive-CTE permission resolution at FR-FLD-06's 20-level nesting
/// cap with realistic group-membership volume (M11.2). Numbers are recorded in
/// TDS §14.1; the assertions here are correctness plus a deliberately generous bound
/// so slow CI hardware does not flake, while still catching pathological regressions
/// (e.g. an accidental N+1 loop returning to the resolver).
/// </summary>
public sealed class PermissionCtePerformanceTests : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId;

    public PermissionCtePerformanceTests(ITestOutputHelper output)
    {
        _output = output;
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSnakeCaseNamingConvention()
            .UseSqlite(_connection)
            .Options);
        _db.Database.EnsureCreated();

        var site = new Site { Name = "Perf", UrlSlug = "perf" };
        site.SetCreator(_userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_userId);
        _db.Sites.Add(site);
        _db.Libraries.Add(library);

        // A 20-level folder chain (FR-FLD-06 cap).
        var parentId = (Guid?)null;
        for (var depth = 0; depth < 20; depth++)
        {
            var folder = new Folder
            {
                LibraryId = library.Id,
                ParentFolderId = parentId,
                Name = $"L{depth}",
                Path = $"/L{depth}/",
            };
            folder.SetCreator(_userId);
            _db.Folders.Add(folder);
            parentId = folder.Id;
        }

        var document = new Document
        {
            LibraryId = library.Id,
            FolderId = parentId,
            Name = "deep.txt",
            ContentType = "text/plain",
        };
        document.SetCreator(_userId);
        _db.Documents.Add(document);
        _db.Users.Add(new ApplicationUser { Id = _userId, UserName = "u", Email = "u@x" });
        _db.SaveChanges();

        // 50 groups x 200 members = 10k memberships; the user belongs to every group.
        var grantGroup = new Group { Name = "grant-group" };
        _db.Groups.Add(grantGroup);
        var userIds = Enumerable.Range(0, 200)
            .Select(_ => Guid.NewGuid())
            .ToList();
        _db.Users.AddRange(userIds.Select(id => new ApplicationUser
        {
            Id = id,
            UserName = $"m{id:N}",
            Email = $"m{id:N}@x",
        }));
        for (var g = 0; g < 49; g++)
        {
            var group = new Group { Name = $"g{g}" };
            _db.Groups.Add(group);
            foreach (var memberId in userIds)
            {
                _db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = memberId });
            }
        }
        foreach (var memberId in userIds)
        {
            _db.GroupMembers.Add(new GroupMember { GroupId = grantGroup.Id, UserId = memberId });
        }
        _db.GroupMembers.Add(new GroupMember { GroupId = grantGroup.Id, UserId = _userId });

        _db.SitePermissions.Add(new SitePermission
        {
            SiteId = site.Id,
            PrincipalType = PrincipalType.Group,
            PrincipalId = grantGroup.Id,
            Role = SiteRole.Visitor,
        });
        // The grant the resolver must find sits at the deepest folder.
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Folder,
            ObjectId = parentId!.Value,
            PrincipalType = PrincipalType.Group,
            PrincipalId = grantGroup.Id,
            Level = PermissionLevel.Read,
            GrantedBy = _userId,
        });
        _db.SaveChanges();

        _documentId = document.Id;
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Resolving_the_deepest_document_stays_within_bounds()
    {
        // The grant is on the group the user belongs to, at the deepest folder level.
        var sanity = new PermissionResolver(_db, new FakeCurrentUser(), new MemoryCache(new MemoryCacheOptions()), new PermissionCacheInvalidator());
        Assert.Equal(PermissionLevel.Read, await sanity.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId));

        const int iterations = 100;
        var sw = Stopwatch.StartNew();
        for (var i = 0; i < iterations; i++)
        {
            var resolver = new PermissionResolver(_db, new FakeCurrentUser(), new MemoryCache(new MemoryCacheOptions()), new PermissionCacheInvalidator());
            var level = await resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId);
            Assert.Equal(PermissionLevel.Read, level);
        }
        sw.Stop();

        var avgUncachedMs = sw.Elapsed.TotalMilliseconds / iterations;

        // Cached path (same resolver instance): measure the cache-hit cost.
        var cached = new PermissionResolver(_db, new FakeCurrentUser(), new MemoryCache(new MemoryCacheOptions()), new PermissionCacheInvalidator());
        await cached.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId);
        sw.Restart();
        for (var i = 0; i < iterations; i++)
        {
            await cached.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId);
        }
        sw.Stop();
        var avgCachedMs = sw.Elapsed.TotalMilliseconds / iterations;

        // Durable record for TDS §14.1 (asserted numbers are generous upper bounds).
        _output.WriteLine(
            $"CTE resolution: {avgUncachedMs:F2} ms avg uncached, {avgCachedMs:F3} ms avg cached (20 levels, 10k memberships, 100 iterations)");
        Assert.True(avgUncachedMs < 500, $"CTE resolution too slow: {avgUncachedMs:F2} ms avg uncached");
        Assert.True(avgCachedMs < 5, $"Cache-hit resolution too slow: {avgCachedMs:F3} ms avg cached");
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId => null;
        public bool IsSystemAdmin => false;
        public string? Email => null;
        public string? IpAddress => null;
    }
}
