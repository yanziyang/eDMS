using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Search;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class SearchServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly SearchService _service;
    private readonly FakeCurrentUser _currentUser = new(Guid.NewGuid());
    private readonly Guid _siteId;
    private readonly Guid _libraryId;
    private readonly Guid _secondLibraryId;

    public SearchServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(_currentUser.UserId!.Value);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(_currentUser.UserId!.Value);
        var secondLibrary = new Library { SiteId = site.Id, Name = "Archive" };
        secondLibrary.SetCreator(_currentUser.UserId!.Value);
        _db.Sites.Add(site);
        _db.Libraries.Add(library);
        _db.Libraries.Add(secondLibrary);
        _db.SaveChanges();

        _siteId = site.Id;
        _libraryId = library.Id;
        _secondLibraryId = secondLibrary.Id;
        _service = new SearchService(_db, _currentUser, new SelectiveResolver(Guid.NewGuid()));
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Search_matches_name_title_and_description_case_insensitively()
    {
        await SeedDocumentAsync("Budget Q4.pdf", "Quarterly Budget", "Numbers for finance");
        await SeedDocumentAsync("unrelated.txt", null, null);

        var results = await _service.SearchAsync("BUDGET", null, null, default);

        var result = Assert.Single(results);
        Assert.Equal("Budget Q4.pdf", result.Name);
    }

    [Fact]
    public async Task Search_filters_by_site_and_library()
    {
        await SeedDocumentAsync("doc-in-library.txt", null, null);
        var other = new Document
        {
            LibraryId = _secondLibraryId,
            Name = "doc-in-archive.txt",
            ContentType = "text/plain",
        };
        other.SetCreator(_currentUser.UserId!.Value);
        _db.Documents.Add(other);
        await _db.SaveChangesAsync();

        var siteResults = await _service.SearchAsync("doc-in", _siteId, null, default);
        Assert.Equal(2, siteResults.Count);

        var libraryResults = await _service.SearchAsync("doc-in", null, _libraryId, default);
        var result = Assert.Single(libraryResults);
        Assert.Equal("doc-in-library.txt", result.Name);
        Assert.Equal(_siteId, result.SiteId);
    }

    [Fact]
    public async Task Search_excludes_documents_without_access()
    {
        await SeedDocumentAsync("visible.txt", null, null);
        await SeedDocumentAsync("hidden.txt", null, null);

        var resolver = new SelectiveResolver(_db.Documents.IgnoreQueryFilters()
            .Single(document => document.Name == "hidden.txt").Id);
        var service = new SearchService(_db, _currentUser, resolver);

        var results = await service.SearchAsync("txt", null, null, default);

        Assert.DoesNotContain(results, result => result.Name == "hidden.txt");
        Assert.Contains(results, result => result.Name == "visible.txt");
    }

    [Fact]
    public async Task Search_without_query_returns_recent_documents()
    {
        await SeedDocumentAsync("one.txt", null, null);
        await SeedDocumentAsync("two.txt", null, null);

        var results = await _service.SearchAsync(null, null, null, default);

        Assert.Equal(2, results.Count);
    }

    [Fact]
    public async Task Search_requires_authenticated_user()
    {
        var anonymous = new SearchService(
            _db,
            new FakeCurrentUser(null),
            new SelectiveResolver(Guid.NewGuid()));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            anonymous.SearchAsync("x", null, null, default));
    }

    [Fact]
    public async Task Search_returns_folder_path_for_documents_in_folders()
    {
        var folder = new Folder { LibraryId = _libraryId, Name = "Nested", Path = "/Nested/" };
        folder.SetCreator(_currentUser.UserId!.Value);
        _db.Folders.Add(folder);
        await _db.SaveChangesAsync();

        var document = new Document
        {
            LibraryId = _libraryId,
            FolderId = folder.Id,
            Name = "in-folder.txt",
            ContentType = "text/plain",
        };
        document.SetCreator(_currentUser.UserId!.Value);
        _db.Documents.Add(document);
        await _db.SaveChangesAsync();

        var results = await _service.SearchAsync("in-folder", null, null, default);

        Assert.Equal("/Nested/", Assert.Single(results).FolderPath);
    }

    private async Task SeedDocumentAsync(string name, string? title, string? description)
    {
        var document = new Document
        {
            LibraryId = _libraryId,
            Name = name,
            Title = title,
            Description = description,
            ContentType = "text/plain",
        };
        document.SetCreator(_currentUser.UserId!.Value);
        document.ModifiedAt = DateTimeOffset.UtcNow;
        _db.Documents.Add(document);
        await _db.SaveChangesAsync();
    }

    private sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => false;
        public string? Email => null;
        public string? IpAddress => null;
    }

    private sealed class SelectiveResolver(Guid deniedDocumentId) : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(Guid userId, ObjectType type, Guid objectId, CancellationToken cancellationToken = default) =>
            Task.FromResult(objectId == deniedDocumentId ? PermissionLevel.NoAccess : PermissionLevel.FullControl);

        public Task RequireAsync(Guid userId, ObjectType type, Guid objectId, PermissionLevel required, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
