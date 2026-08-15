using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class PermissionResolverTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly PermissionResolver _resolver;
    private readonly IPermissionCacheInvalidator _invalidator;

    public PermissionResolverTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        _invalidator = new PermissionCacheInvalidator();
        _resolver = new PermissionResolver(
            _db,
            new FixedCurrentUser(isSystemAdmin: false),
            new MemoryCache(new MemoryCacheOptions()),
            _invalidator);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task System_administrator_bypasses_to_full_control()
    {
        var adminResolver = new PermissionResolver(
            _db,
            new FixedCurrentUser(isSystemAdmin: true),
            new MemoryCache(new MemoryCacheOptions()),
            _invalidator);

        var level = await adminResolver.GetEffectiveLevelAsync(Guid.NewGuid(), ObjectType.Site, Guid.NewGuid());

        Assert.Equal(PermissionLevel.FullControl, level);
    }

    [Fact]
    public async Task Group_membership_grants_are_additive_across_groups()
    {
        var ownerId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var site = await SeedSiteAsync(ownerId);
        var membersGroup = _db.Groups.Single(group => group.Name.EndsWith("Members", StringComparison.Ordinal));
        var visitorsGroup = _db.Groups.Single(group => group.Name.EndsWith("Visitors", StringComparison.Ordinal));

        _db.GroupMembers.AddRange(
            new GroupMember { GroupId = membersGroup.Id, UserId = userId },
            new GroupMember { GroupId = visitorsGroup.Id, UserId = userId });
        await _db.SaveChangesAsync();
        _invalidator.Invalidate();

        var level = await _resolver.GetEffectiveLevelAsync(userId, ObjectType.Site, site.Id);

        Assert.Equal(PermissionLevel.Contribute, level);
    }

    [Fact]
    public async Task Non_member_has_no_access()
    {
        var userId = Guid.NewGuid();
        var site = await SeedSiteAsync(userId);

        var level = await _resolver.GetEffectiveLevelAsync(Guid.NewGuid(), ObjectType.Site, site.Id);

        Assert.Equal(PermissionLevel.NoAccess, level);
    }

    [Fact]
    public async Task Unique_folder_acl_grants_access_without_site_membership()
    {
        var ownerId = Guid.NewGuid();
        var readerId = Guid.NewGuid();
        var site = await SeedSiteAsync(ownerId);

        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(ownerId);
        var folder = new Folder { LibraryId = library.Id, Name = "Secret", Path = "/Secret/" };
        folder.SetCreator(ownerId);
        _db.Libraries.Add(library);
        _db.Folders.Add(folder);
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Folder,
            ObjectId = folder.Id,
            PrincipalType = PrincipalType.User,
            PrincipalId = readerId,
            Level = PermissionLevel.Read,
            GrantedBy = ownerId,
        });
        await _db.SaveChangesAsync();
        _invalidator.Invalidate();

        var folderLevel = await _resolver.GetEffectiveLevelAsync(readerId, ObjectType.Folder, folder.Id);
        var libraryLevel = await _resolver.GetEffectiveLevelAsync(readerId, ObjectType.Library, library.Id);

        Assert.Equal(PermissionLevel.Read, folderLevel);
        Assert.Equal(PermissionLevel.NoAccess, libraryLevel);
    }

    private async Task<Site> SeedSiteAsync(Guid ownerId)
    {
        var site = new Site { Name = "Finance", UrlSlug = "finance" };
        site.SetCreator(ownerId);

        var owners = new Group { Name = "Finance Owners", IsSystem = true, SiteId = site.Id };
        var members = new Group { Name = "Finance Members", IsSystem = true, SiteId = site.Id };
        var visitors = new Group { Name = "Finance Visitors", IsSystem = true, SiteId = site.Id };
        owners.SetCreator(ownerId);
        members.SetCreator(ownerId);
        visitors.SetCreator(ownerId);

        _db.Sites.Add(site);
        _db.Groups.AddRange(owners, members, visitors);
        _db.SitePermissions.AddRange(
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = owners.Id, Role = SiteRole.Owner },
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = members.Id, Role = SiteRole.Member },
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = visitors.Id, Role = SiteRole.Visitor });
        _db.GroupMembers.Add(new GroupMember { GroupId = owners.Id, UserId = ownerId });
        await _db.SaveChangesAsync();
        return site;
    }

    private sealed class FixedCurrentUser(bool isSystemAdmin) : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();

        public bool IsSystemAdmin => isSystemAdmin;

        public string? Email => null;

        public string? IpAddress => null;
    }
}
