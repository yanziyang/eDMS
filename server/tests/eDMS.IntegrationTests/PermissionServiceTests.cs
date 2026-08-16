using eDMS.Application.Common.Interfaces;
using eDMS.Application.Permissions;
using eDMS.Domain;
using eDMS.Infrastructure.Permissions;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class PermissionServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly PermissionService _service;
    private readonly FakeCurrentUser _currentUser = new(Guid.NewGuid());
    private readonly FakeEmailSender _emailSender = new();
    private readonly Guid _siteId;
    private readonly Guid _libraryId;
    private readonly Guid _folderId;
    private readonly Guid _documentId;
    private readonly Guid _groupPrincipalId;

    public PermissionServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(_currentUser.UserId!.Value);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_currentUser.UserId!.Value);
        var folder = new Folder { LibraryId = library.Id, Name = "Folder", Path = "/Folder/" };
        folder.SetCreator(_currentUser.UserId!.Value);
        var document = new Document { LibraryId = library.Id, FolderId = folder.Id, Name = "doc.txt", ContentType = "text/plain" };
        document.SetCreator(_currentUser.UserId!.Value);
        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Folders.Add(folder);
        _db.Documents.Add(document);
        _db.SitePermissions.Add(new SitePermission
        {
            SiteId = site.Id,
            PrincipalType = PrincipalType.User,
            PrincipalId = _currentUser.UserId!.Value,
            Role = SiteRole.Owner,
        });
        var principalGroup = new Group { Name = "G" };
        _db.Groups.Add(principalGroup);
        _db.SaveChanges();

        _siteId = site.Id;
        _libraryId = library.Id;
        _folderId = folder.Id;
        _documentId = document.Id;
        _groupPrincipalId = principalGroup.Id;

        _service = new PermissionService(
            _db,
            _currentUser,
            new AllowAllResolver(),
            new PermissionCacheInvalidatorStub(),
            _emailSender,
            new FakeAuditLogger());
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetPermissions_returns_inherited_site_entries_when_no_unique_acl()
    {
        var result = await _service.GetPermissionsAsync(ObjectType.Site, _siteId, default);

        Assert.False(result.HasUniqueAcl);
        Assert.Contains(result.Entries, entry =>
            entry.PrincipalId == _currentUser.UserId!.Value && entry.Source == "Inherited");
    }

    [Theory]
    [InlineData(ObjectType.Library)]
    [InlineData(ObjectType.Folder)]
    [InlineData(ObjectType.Document)]
    public async Task GetPermissions_resolves_site_for_all_object_types(ObjectType objectType)
    {
        var objectId = objectType switch
        {
            ObjectType.Library => _libraryId,
            ObjectType.Folder => _folderId,
            ObjectType.Document => _documentId,
            _ => _siteId,
        };

        var result = await _service.GetPermissionsAsync(objectType, objectId, default);

        Assert.False(result.HasUniqueAcl);
        Assert.NotEmpty(result.Entries);
    }

    [Fact]
    public async Task GetPermissions_resolves_group_principal_name()
    {
        _db.ItemPermissions.Add(new ItemPermission
        {
            ObjectType = ObjectType.Document,
            ObjectId = _documentId,
            PrincipalType = PrincipalType.Group,
            PrincipalId = _groupPrincipalId,
            Level = PermissionLevel.Read,
            GrantedBy = _currentUser.UserId!.Value,
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetPermissionsAsync(ObjectType.Document, _documentId, default);

        Assert.True(result.HasUniqueAcl);
        Assert.Contains(result.Entries, entry =>
            entry.PrincipalType == "Group" && entry.PrincipalName == "G" && entry.Source == "Direct");
    }

    [Fact]
    public async Task Grant_updates_existing_entry_instead_of_duplicating()
    {
        await _service.GrantAsync(
            ObjectType.Document, _documentId, PrincipalType.User, _currentUser.UserId!.Value,
            PermissionLevel.Read, default);
        await _service.GrantAsync(
            ObjectType.Document, _documentId, PrincipalType.User, _currentUser.UserId!.Value,
            PermissionLevel.FullControl, default);

        var entries = _db.ItemPermissions
            .Where(permission => permission.ObjectId == _documentId).ToList();
        Assert.Single(entries);
        Assert.Equal(PermissionLevel.FullControl, entries[0].Level);
    }

    [Fact]
    public async Task Revoke_missing_entry_is_a_noop()
    {
        await _service.RevokeAsync(
            ObjectType.Document, _documentId, PrincipalType.User, Guid.NewGuid(), default);
    }

    [Fact]
    public async Task ResetInheritance_removes_all_unique_entries()
    {
        await _service.GrantAsync(
            ObjectType.Document, _documentId, PrincipalType.User, Guid.NewGuid(),
            PermissionLevel.Read, default);

        await _service.ResetInheritanceAsync(ObjectType.Document, _documentId, default);

        Assert.Empty(_db.ItemPermissions.Where(permission => permission.ObjectId == _documentId));
    }

    [Fact]
    public async Task Share_grants_and_emails_when_recipient_has_email()
    {
        var recipient = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "recipient@edms.test",
            Email = "recipient@edms.test",
            DisplayName = "Recipient",
        };
        _db.Users.Add(recipient);
        await _db.SaveChangesAsync();

        await _service.ShareAsync(
            ObjectType.Document, _documentId, recipient.Id, PermissionLevel.Read, default);

        Assert.NotEmpty(_emailSender.Sent);
        Assert.Contains(_db.ItemPermissions, permission =>
            permission.ObjectId == _documentId && permission.PrincipalId == recipient.Id);
    }

    [Fact]
    public async Task Share_without_matching_user_does_not_email()
    {
        await _service.ShareAsync(
            ObjectType.Document, _documentId, Guid.NewGuid(), PermissionLevel.Read, default);

        Assert.Empty(_emailSender.Sent);
    }

    private sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => true;
        public string? Email => "admin@edms.test";
        public string? IpAddress => null;
    }

    private sealed class AllowAllResolver : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(Guid userId, ObjectType type, Guid objectId, CancellationToken cancellationToken = default) =>
            Task.FromResult(PermissionLevel.FullControl);

        public Task RequireAsync(Guid userId, ObjectType type, Guid objectId, PermissionLevel required, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public List<(string To, string Subject, string Body)> Sent { get; } = [];

        public Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Sent.Add((to, subject, htmlBody));
            return Task.CompletedTask;
        }
    }

    private sealed class FakeAuditLogger : IAuditLogger
    {
        public Task LogAsync(AuditAction action, ObjectType objectType, Guid objectId, string objectName, Guid? siteId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task LogAuthAsync(Guid userId, AuditAction action, string objectName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class PermissionCacheInvalidatorStub : IPermissionCacheInvalidator
    {
        public long Generation { get; private set; }

        public void Invalidate() => Generation++;
    }
}
