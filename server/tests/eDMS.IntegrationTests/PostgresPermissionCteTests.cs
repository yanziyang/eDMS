using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Testcontainers.PostgreSql;

namespace eDMS.IntegrationTests;

/// <summary>
/// Runs the permission-hierarchy CTE against a real PostgreSQL container (M10.1).
/// Docker-less machines (e.g. a local dev box without Docker Desktop) skip the body;
/// CI runners provide Docker and execute these tests for real.
/// </summary>
public sealed class PostgresPermissionCteTests : IAsyncLifetime
{
    private bool _available;
    private PostgreSqlContainer? _container;
    private AppDbContext? _db;
    private PermissionResolver? _resolver;

    public async Task InitializeAsync()
    {
        try
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine")
                .Build();
            await _container.StartAsync();
        }
        catch (Exception)
        {
            _available = false;
            return;
        }

        _available = true;
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                _container.GetConnectionString(),
                npgsql => npgsql.MigrationsAssembly("eDMS.Infrastructure.Migrations.Postgres"))
            .Options;
        _db = new AppDbContext(options);
        await _db.Database.MigrateAsync();
        _resolver = new PermissionResolver(
            _db,
            new FakeCurrentUser(),
            new MemoryCache(new MemoryCacheOptions()),
            new PermissionCacheInvalidator());
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
        if (_available && _container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    [Fact]
    public async Task Unique_acl_at_each_level_resolves_via_the_cte()
    {
        if (!_available)
        {
            return;
        }

        var userId = Guid.NewGuid();
        var (siteId, libraryId, folderId, childFolderId, documentId) = await SeedHierarchyAsync(userId);

        // Grant unique ACLs at three different levels with different levels.
        _db!.SitePermissions.Add(new SitePermission
        {
            SiteId = siteId,
            PrincipalType = PrincipalType.User,
            PrincipalId = userId,
            Role = SiteRole.Member,
        });
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Folder,
            ObjectId = folderId,
            PrincipalType = PrincipalType.User,
            PrincipalId = userId,
            Level = PermissionLevel.FullControl,
            GrantedBy = userId,
        });
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Document,
            ObjectId = documentId,
            PrincipalType = PrincipalType.User,
            PrincipalId = userId,
            Level = PermissionLevel.Read,
            GrantedBy = userId,
        });
        await _db.SaveChangesAsync();

        Assert.Equal(PermissionLevel.Read, await _resolver!.GetEffectiveLevelAsync(userId, ObjectType.Document, documentId));
        Assert.Equal(PermissionLevel.FullControl, await _resolver.GetEffectiveLevelAsync(userId, ObjectType.Folder, childFolderId));
        Assert.Equal(PermissionLevel.Contribute, await _resolver.GetEffectiveLevelAsync(userId, ObjectType.Library, libraryId));
    }

    [Fact]
    public async Task Group_grants_are_additive_most_permissive_wins()
    {
        if (!_available)
        {
            return;
        }

        var userId = Guid.NewGuid();
        var (siteId, _, _, _, documentId) = await SeedHierarchyAsync(userId);

        var visitorGroup = new Group { Name = $"visitors-{Guid.NewGuid():N}" };
        var ownerGroup = new Group { Name = $"owners-{Guid.NewGuid():N}" };
        _db!.Groups.AddRange(visitorGroup, ownerGroup);
        _db.SitePermissions.AddRange(
            new SitePermission
            {
                SiteId = siteId,
                PrincipalType = PrincipalType.Group,
                PrincipalId = visitorGroup.Id,
                Role = SiteRole.Visitor,
            },
            new SitePermission
            {
                SiteId = siteId,
                PrincipalType = PrincipalType.Group,
                PrincipalId = ownerGroup.Id,
                Role = SiteRole.Owner,
            });
        _db.GroupMembers.AddRange(
            new GroupMember { GroupId = visitorGroup.Id, UserId = userId },
            new GroupMember { GroupId = ownerGroup.Id, UserId = userId });
        await _db.SaveChangesAsync();

        Assert.Equal(PermissionLevel.FullControl, await _resolver!.GetEffectiveLevelAsync(userId, ObjectType.Document, documentId));
    }

    private async Task<(Guid SiteId, Guid LibraryId, Guid FolderId, Guid ChildFolderId, Guid DocumentId)>
        SeedHierarchyAsync(Guid userId)
    {
        var site = new Site { Name = "CTE Site", UrlSlug = $"cte-{Guid.NewGuid():N}"[..16] };
        site.SetCreator(userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(userId);
        var folder = new Folder { LibraryId = library.Id, Name = "Folder", Path = "/Folder/" };
        folder.SetCreator(userId);
        var childFolder = new Folder
        {
            LibraryId = library.Id,
            ParentFolderId = folder.Id,
            Name = "Child",
            Path = "/Folder/Child/",
        };
        childFolder.SetCreator(userId);
        var document = new Document
        {
            LibraryId = library.Id,
            FolderId = childFolder.Id,
            Name = "doc.txt",
            ContentType = "text/plain",
        };
        document.SetCreator(userId);

        _db!.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Folders.Add(folder);
        _db.Folders.Add(childFolder);
        _db.Documents.Add(document);
        _db.Users.Add(new ApplicationUser { Id = userId, UserName = "user", Email = "user@edms.test" });
        await _db.SaveChangesAsync();

        return (site.Id, library.Id, folder.Id, childFolder.Id, document.Id);
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId => null;
        public bool IsSystemAdmin => false;
        public string? Email => null;
        public string? IpAddress => null;

        public string? ShareToken => null;
    }
}
