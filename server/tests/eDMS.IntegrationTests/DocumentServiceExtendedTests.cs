using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Documents;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class DocumentServiceExtendedTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly DocumentService _service;
    private readonly FakeCurrentUser _currentUser = new(Guid.NewGuid());
    private readonly FakeStorage _storage = new();
    private readonly Guid _libraryId;

    public DocumentServiceExtendedTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(_currentUser.UserId!.Value);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_currentUser.UserId!.Value);
        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.SaveChanges();
        _libraryId = library.Id;

        _service = new DocumentService(
            _db,
            _storage,
            _currentUser,
            new AllowAllResolver(),
            new FakeAuditLogger(),
            new TestAppSettings { MaxUploadSizeBytes = 1024 });
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task ListAsync_returns_folders_and_documents_with_sizes()
    {
        var folder = new Folder { LibraryId = _libraryId, Name = "Folder", Path = "/Folder/" };
        folder.SetCreator(_currentUser.UserId!.Value);
        _db.Folders.Add(folder);
        await _db.SaveChangesAsync();

        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("12345"), default);

        var items = await _service.ListAsync(_libraryId, null, default);
        Assert.Contains(items, item => item.Kind == "folder" && item.Name == "Folder");
        Assert.Contains(items, item => item.Kind == "document" && item.Name == "doc.txt" && item.SizeBytes == 5);

        var folderItems = await _service.ListAsync(_libraryId, folder.Id, default);
        Assert.Empty(folderItems);
    }

    [Fact]
    public async Task ListFolderAsync_requires_existing_folder()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ListFolderAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Upload_oversized_file_is_rejected()
    {
        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.UploadAsync(_libraryId, null, "big.txt", Stream(new string('a', 2048)), default));
    }

    [Fact]
    public async Task UploadToFolderAsync_requires_existing_folder()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UploadToFolderAsync(Guid.NewGuid(), "x.txt", Stream("data"), default));
    }

    [Fact]
    public async Task Reupload_while_checked_out_by_another_user_is_rejected()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);

        var other = new FakeCurrentUser(Guid.NewGuid());
        var otherService = new DocumentService(
            _db, _storage, other, new AllowAllResolver(), new FakeAuditLogger(),
            TestSupport.DefaultAppSettings());
        await otherService.CheckOutAsync(upload.DocumentId, default);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v2"), default));
    }

    [Fact]
    public async Task Download_requires_existing_document()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DownloadAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task GetAsync_requires_existing_document()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task DeleteAsync_requires_existing_document()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DeleteAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Rename_and_update_metadata_require_existing_document()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RenameAsync(Guid.NewGuid(), "x", default));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UpdateMetadataAsync(Guid.NewGuid(), "t", "d", default));
    }

    [Fact]
    public async Task Checkout_by_other_user_and_admin_checkin()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        await _service.CheckOutAsync(upload.DocumentId, default);

        var other = new FakeCurrentUser(Guid.NewGuid());
        var otherService = new DocumentService(
            _db, _storage, other, new AllowAllResolver(), new FakeAuditLogger(),
            TestSupport.DefaultAppSettings());
        await Assert.ThrowsAsync<ConflictException>(() =>
            otherService.CheckOutAsync(upload.DocumentId, default));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            otherService.CheckInAsync(upload.DocumentId, null, default));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            otherService.DiscardCheckoutAsync(upload.DocumentId, default));

        var admin = new FakeCurrentUser(Guid.NewGuid()) { IsAdmin = true };
        var adminService = new DocumentService(
            _db, _storage, admin, new AllowAllResolver(), new FakeAuditLogger(),
            TestSupport.DefaultAppSettings());
        await adminService.CheckInAsync(upload.DocumentId, "admin checkin", default);
    }

    [Fact]
    public async Task Checkin_without_checkout_is_rejected()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CheckInAsync(upload.DocumentId, null, default));
    }

    [Fact]
    public async Task Restore_version_requires_existing_version()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RestoreVersionAsync(upload.DocumentId, Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Discard_checkout_by_owner_works()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        await _service.CheckOutAsync(upload.DocumentId, default);
        await _service.DiscardCheckoutAsync(upload.DocumentId, default);
        Assert.Null(_db.Documents.Single().CheckedOutBy);
    }

    [Fact]
    public async Task No_user_throws_forbidden()
    {
        var anonymous = new DocumentService(
            _db, _storage, new FakeCurrentUser(null), new AllowAllResolver(), new FakeAuditLogger(),
            TestSupport.DefaultAppSettings());
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            anonymous.ListAsync(_libraryId, null, default));
    }

    private static Stream Stream(string content) => new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

    private sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => IsAdmin;
        public bool IsAdmin { get; init; }
        public string? Email => "user@edms.local";
        public string? IpAddress => null;
        public string? ShareToken => null;
    }

    private sealed class FakeStorage : IFileStorageProvider
    {
        private readonly Dictionary<string, byte[]> _files = [];

        public async Task<string> SaveAsync(Stream content, string suggestedKey, CancellationToken cancellationToken = default)
        {
            using var memory = new MemoryStream();
            await content.CopyToAsync(memory, cancellationToken);
            _files[suggestedKey] = memory.ToArray();
            return suggestedKey;
        }

        public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default) =>
            Task.FromResult<Stream>(new MemoryStream(_files[storageKey]));

        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
        {
            _files.Remove(storageKey);
            return Task.CompletedTask;
        }
    }

    private sealed class AllowAllResolver : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(Guid userId, ObjectType type, Guid objectId, CancellationToken cancellationToken = default) =>
            Task.FromResult(PermissionLevel.FullControl);

        public Task RequireAsync(Guid userId, ObjectType type, Guid objectId, PermissionLevel required, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeAuditLogger : IAuditLogger
    {
        public Task LogAsync(AuditAction action, ObjectType objectType, Guid objectId, string objectName, Guid? siteId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task LogAuthAsync(Guid userId, AuditAction action, string objectName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
