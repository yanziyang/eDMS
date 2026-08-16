using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.RecycleBin;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.RecycleBin;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class RecycleBinServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly RecycleBinService _service;
    private readonly FakeCurrentUser _currentUser = new(Guid.NewGuid());
    private readonly FakeStorage _storage = new();
    private readonly Guid _siteId;
    private readonly Guid _libraryId;

    public RecycleBinServiceTests()
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

        _siteId = site.Id;
        _libraryId = library.Id;

        _service = new RecycleBinService(_db, _currentUser, new AllowAllResolver(), _storage);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task ListAsync_returns_deleted_documents_and_folders_sorted()
    {
        var document = NewDocument("doc.txt");
        document.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow.AddHours(-1));
        var folder = NewFolder("Folder", "/Folder/");
        folder.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        _db.Documents.Add(document);
        _db.Folders.Add(folder);
        await _db.SaveChangesAsync();

        var items = await _service.ListAsync(_siteId, default);

        Assert.Equal(2, items.Count);
        Assert.Equal("folder", items[0].Kind);
        Assert.Equal("document", items[1].Kind);
    }

    [Fact]
    public async Task Restore_document_requires_existing_item()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RestoreAsync(ObjectType.Document, Guid.NewGuid(), default));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RestoreAsync(ObjectType.Folder, Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Restore_folder_restores_descendants()
    {
        var parent = NewFolder("Parent", path: "/Parent/");
        var child = NewFolder("Child", path: "/Parent/Child/");
        parent.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        child.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        _db.Folders.AddRange(parent, child);
        await _db.SaveChangesAsync();

        await _service.RestoreAsync(ObjectType.Folder, parent.Id, default);

        Assert.All(_db.Folders.IgnoreQueryFilters(), folder => Assert.False(folder.IsDeleted));
    }

    [Fact]
    public async Task PermanentlyDelete_document_removes_versions_and_storage()
    {
        var document = NewDocument("doc.txt");
        document.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        var version = new DocumentVersion
        {
            DocumentId = document.Id,
            VersionMajor = 1,
            StorageKey = "key/1",
            Checksum = "c",
        };
        version.SetCreator(_currentUser.UserId!.Value);
        _db.Documents.Add(document);
        _db.DocumentVersions.Add(version);
        await _db.SaveChangesAsync();

        await _service.PermanentlyDeleteAsync(ObjectType.Document, document.Id, default);

        Assert.Empty(_db.Documents.IgnoreQueryFilters());
        Assert.Empty(_db.DocumentVersions);
        Assert.Contains("key/1", _storage.Deleted);
    }

    [Fact]
    public async Task PermanentlyDelete_folder_removes_descendants_documents_and_storage()
    {
        var parent = NewFolder("Parent", path: "/Parent/");
        parent.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        var document = NewDocument("doc.txt", folderId: parent.Id);
        document.MarkDeleted(_currentUser.UserId!.Value, DateTimeOffset.UtcNow);
        var version = new DocumentVersion
        {
            DocumentId = document.Id,
            VersionMajor = 1,
            StorageKey = "key/2",
            Checksum = "c",
        };
        version.SetCreator(_currentUser.UserId!.Value);
        _db.Folders.Add(parent);
        _db.Documents.Add(document);
        _db.DocumentVersions.Add(version);
        await _db.SaveChangesAsync();

        await _service.PermanentlyDeleteAsync(ObjectType.Folder, parent.Id, default);

        Assert.Empty(_db.Folders.IgnoreQueryFilters());
        Assert.Empty(_db.Documents.IgnoreQueryFilters());
        Assert.Empty(_db.DocumentVersions);
        Assert.Contains("key/2", _storage.Deleted);
    }

    [Fact]
    public async Task PermanentlyDelete_missing_item_throws_not_found()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.PermanentlyDeleteAsync(ObjectType.Document, Guid.NewGuid(), default));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.PermanentlyDeleteAsync(ObjectType.Folder, Guid.NewGuid(), default));
    }

    private Document NewDocument(string name, Guid? folderId = null)
    {
        var document = new Document
        {
            LibraryId = _libraryId,
            FolderId = folderId,
            Name = name,
            ContentType = "text/plain",
        };
        document.SetCreator(_currentUser.UserId!.Value);
        return document;
    }

    private Folder NewFolder(string name, string path)
    {
        var folder = new Folder { LibraryId = _libraryId, Name = name, Path = path };
        folder.SetCreator(_currentUser.UserId!.Value);
        return folder;
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

    private sealed class FakeStorage : IFileStorageProvider
    {
        public List<string> Deleted { get; } = [];

        public Task<string> SaveAsync(Stream content, string suggestedKey, CancellationToken cancellationToken = default) =>
            Task.FromResult(suggestedKey);

        public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default) =>
            Task.FromResult<Stream>(new MemoryStream());

        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
        {
            Deleted.Add(storageKey);
            return Task.CompletedTask;
        }
    }
}
