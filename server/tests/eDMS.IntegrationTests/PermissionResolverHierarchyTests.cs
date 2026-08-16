using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace eDMS.IntegrationTests;

public sealed class PermissionResolverHierarchyTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly PermissionResolver _resolver;
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly Guid _siteId;
    private readonly Guid _libraryId;
    private readonly Guid _folderId;
    private readonly Guid _childFolderId;
    private readonly Guid _documentId;
    private readonly Guid _documentInFolderId;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupA;
    private readonly Guid _groupB;

    public PermissionResolverHierarchyTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSnakeCaseNamingConvention()
            .UseSqlite(_connection)
            .Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(_userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_userId);
        var folder = new Folder { LibraryId = library.Id, Name = "Folder", Path = "/Folder/" };
        folder.SetCreator(_userId);
        var childFolder = new Folder
        {
            LibraryId = library.Id,
            ParentFolderId = folder.Id,
            Name = "Child",
            Path = "/Folder/Child/",
        };
        childFolder.SetCreator(_userId);
        var document = new Document { LibraryId = library.Id, Name = "root.txt", ContentType = "text/plain" };
        document.SetCreator(_userId);
        var documentInFolder = new Document
        {
            LibraryId = library.Id,
            FolderId = childFolder.Id,
            Name = "nested.txt",
            ContentType = "text/plain",
        };
        documentInFolder.SetCreator(_userId);

        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Folders.Add(folder);
        _db.Folders.Add(childFolder);
        _db.Documents.Add(document);
        _db.Documents.Add(documentInFolder);
        var groupA = new Group { Name = "A" };
        var groupB = new Group { Name = "B" };
        _db.Users.Add(new ApplicationUser { Id = _userId, UserName = "user", Email = "user@edms.test" });
        _db.Groups.Add(groupA);
        _db.Groups.Add(groupB);
        _db.SaveChanges();

        _siteId = site.Id;
        _libraryId = library.Id;
        _folderId = folder.Id;
        _childFolderId = childFolder.Id;
        _documentId = document.Id;
        _documentInFolderId = documentInFolder.Id;
        _groupA = groupA.Id;
        _groupB = groupB.Id;

        _resolver = new PermissionResolver(
            _db,
            new FakeCurrentUser(false),
            _cache,
            new PermissionCacheInvalidator());
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task No_grants_yields_no_access_at_every_level()
    {
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Library, _libraryId));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Folder, _folderId));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId));
    }

    [Fact]
    public async Task Site_role_grants_access_to_everything_below()
    {
        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Member);

        Assert.Equal(PermissionLevel.Contribute, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));
        Assert.Equal(PermissionLevel.Contribute, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Library, _libraryId));
        Assert.Equal(PermissionLevel.Contribute, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId));
    }

    [Fact]
    public async Task Group_membership_grants_site_access()
    {
        _db.GroupMembers.Add(new GroupMember { GroupId = _groupA, UserId = _userId });
        await AddSitePermissionAsync(_groupA, PrincipalType.Group, SiteRole.Visitor);

        Assert.Equal(PermissionLevel.Read, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));
    }

    [Fact]
    public async Task Group_grants_are_additive_most_permissive_wins()
    {
        _db.GroupMembers.Add(new GroupMember { GroupId = _groupA, UserId = _userId });
        _db.GroupMembers.Add(new GroupMember { GroupId = _groupB, UserId = _userId });
        await AddSitePermissionAsync(_groupA, PrincipalType.Group, SiteRole.Visitor);
        await AddSitePermissionAsync(_groupB, PrincipalType.Group, SiteRole.Owner);

        Assert.Equal(PermissionLevel.FullControl, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));
    }

    [Fact]
    public async Task Unique_acl_on_folder_overrides_site_role()
    {
        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Owner);
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Folder,
            ObjectId = _childFolderId,
            PrincipalType = PrincipalType.User,
            PrincipalId = _userId,
            Level = PermissionLevel.Read,
            GrantedBy = _userId,
        });
        await _db.SaveChangesAsync();

        Assert.Equal(PermissionLevel.Read, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Folder, _childFolderId));
        Assert.Equal(PermissionLevel.Read, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentInFolderId));
        Assert.Equal(PermissionLevel.FullControl, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId));
    }

    [Fact]
    public async Task Unique_acl_on_parent_folder_applies_to_nested_folder()
    {
        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Member);
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Folder,
            ObjectId = _folderId,
            PrincipalType = PrincipalType.User,
            PrincipalId = _userId,
            Level = PermissionLevel.FullControl,
            GrantedBy = _userId,
        });
        await _db.SaveChangesAsync();

        Assert.Equal(PermissionLevel.FullControl, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Folder, _childFolderId));
    }

    [Fact]
    public async Task Item_permission_via_group_membership_applies()
    {
        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Visitor);
        _db.GroupMembers.Add(new GroupMember { GroupId = _groupA, UserId = _userId });
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Document,
            ObjectId = _documentId,
            PrincipalType = PrincipalType.Group,
            PrincipalId = _groupA,
            Level = PermissionLevel.FullControl,
            GrantedBy = _userId,
        });
        await _db.SaveChangesAsync();

        Assert.Equal(PermissionLevel.FullControl, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, _documentId));
    }

    [Fact]
    public async Task Unknown_object_returns_no_access()
    {
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Library, Guid.NewGuid()));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Folder, Guid.NewGuid()));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, Guid.NewGuid()));
        Assert.Equal(PermissionLevel.NoAccess, await _resolver.GetEffectiveLevelAsync(_userId, (ObjectType)99, Guid.NewGuid()));
    }

    [Fact]
    public async Task System_admin_bypasses_everything()
    {
        var resolver = new PermissionResolver(
            _db,
            new FakeCurrentUser(true),
            new MemoryCache(new MemoryCacheOptions()),
            new PermissionCacheInvalidator());

        Assert.Equal(PermissionLevel.FullControl, await resolver.GetEffectiveLevelAsync(_userId, ObjectType.Document, Guid.NewGuid()));
    }

    [Fact]
    public async Task RequireAsync_throws_forbidden_when_level_insufficient()
    {
        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Visitor);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _resolver.RequireAsync(_userId, ObjectType.Site, _siteId, PermissionLevel.Contribute));

        await _resolver.RequireAsync(_userId, ObjectType.Site, _siteId, PermissionLevel.Read);
    }

    [Fact]
    public async Task Cached_result_is_invalidated_by_generation_bump()
    {
        var invalidator = new PermissionCacheInvalidator();
        var resolver = new PermissionResolver(_db, new FakeCurrentUser(false), _cache, invalidator);

        await AddSitePermissionAsync(_userId, PrincipalType.User, SiteRole.Member);
        Assert.Equal(PermissionLevel.Contribute, await resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));

        // Grant a stronger role; without invalidation the cached Contribute would stick.
        var stronger = new SitePermission
        {
            SiteId = _siteId,
            PrincipalType = PrincipalType.User,
            PrincipalId = _userId,
            Role = SiteRole.Owner,
        };
        _db.SitePermissions.RemoveRange(_db.SitePermissions.Where(p => p.SiteId == _siteId));
        _db.SitePermissions.Add(stronger);
        await _db.SaveChangesAsync();
        invalidator.Invalidate();

        Assert.Equal(PermissionLevel.FullControl, await resolver.GetEffectiveLevelAsync(_userId, ObjectType.Site, _siteId));
    }

    private async Task AddSitePermissionAsync(Guid principalId, PrincipalType type, SiteRole role)
    {
        _db.SitePermissions.Add(new SitePermission
        {
            SiteId = _siteId,
            PrincipalType = type,
            PrincipalId = principalId,
            Role = role,
        });
        await _db.SaveChangesAsync();
    }

    private sealed class FakeCurrentUser(bool isSystemAdmin) : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();
        public bool IsSystemAdmin => isSystemAdmin;
        public string? Email => null;
        public string? IpAddress => null;

        public string? ShareToken => null;
    }
}
