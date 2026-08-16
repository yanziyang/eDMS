using System.Text;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using eDMS.Domain;
using eDMS.Infrastructure.Documents;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Xunit;

namespace eDMS.IntegrationTests;

public sealed class DocumentServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly DocumentService _service;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _siteId;
    private readonly Guid _libraryId;

    public DocumentServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(_userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_userId);
        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.SaveChanges();

        _siteId = site.Id;
        _libraryId = library.Id;

        _service = new DocumentService(
            _db,
            new FakeStorage(),
            new FakeCurrentUser(_userId),
            new AllowAllResolver(),
            new FakeAuditLogger(),
            TestSupport.DefaultAppSettings());
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Reupload_creates_a_new_version_not_a_duplicate_document()
    {
        var first = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        var second = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v2"), default);

        Assert.Equal("1.0", first.VersionLabel);
        Assert.Equal("2.0", second.VersionLabel);
        Assert.Single(_db.Documents.IgnoreQueryFilters());
        Assert.Equal(2, _db.DocumentVersions.Count());
    }

    [Fact]
    public async Task Checkout_then_checkin_clears_the_lock()
    {
        var upload = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);

        await _service.CheckOutAsync(upload.DocumentId, default);
        Assert.Equal(_userId, _db.Documents.Single().CheckedOutBy);

        await _service.CheckInAsync(upload.DocumentId, "done", default);
        Assert.Null(_db.Documents.Single().CheckedOutBy);
    }

    [Fact]
    public async Task Restore_creates_a_new_version_with_old_content()
    {
        var first = await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v1"), default);
        await _service.UploadAsync(_libraryId, null, "doc.txt", Stream("v2"), default);

        await _service.RestoreVersionAsync(first.DocumentId, first.VersionId, default);

        var versions = await _service.ListVersionsAsync(first.DocumentId, default);
        Assert.Equal(3, versions.Count);
        Assert.Equal(3, versions[0].VersionMajor);
    }

    private static Stream Stream(string content) => new MemoryStream(Encoding.UTF8.GetBytes(content));

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

    private sealed class FakeCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => false;
        public string? Email => "user@edms.local";
        public string? IpAddress => null;
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
