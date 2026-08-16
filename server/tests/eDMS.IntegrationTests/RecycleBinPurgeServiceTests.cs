using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Background;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class RecycleBinPurgeServiceTests
{
    [Fact]
    public async Task Purge_removes_documents_deleted_before_retention_window()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var storage = new RecordingStorage();

        var site = new Site { Name = "Test", UrlSlug = "test" };
        site.SetCreator(Guid.NewGuid());
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(Guid.NewGuid());
        db.Sites.Add(site);
        db.Libraries.Add(library);
        await db.SaveChangesAsync();

        var stale = NewDocument(db, library.Id, "stale.txt", DateTimeOffset.UtcNow.AddDays(-200));
        var fresh = NewDocument(db, library.Id, "fresh.txt", DateTimeOffset.UtcNow.AddDays(-1));
        db.Documents.Add(stale);
        db.Documents.Add(fresh);
        await db.SaveChangesAsync();

        foreach (var document in new[] { stale, fresh })
        {
            var version = new DocumentVersion
            {
                DocumentId = document.Id,
                VersionMajor = 1,
                StorageKey = $"key/{document.Id}",
                Checksum = "c",
            };
            version.SetCreator(Guid.NewGuid());
            db.DocumentVersions.Add(version);
        }
        await db.SaveChangesAsync();

        var services = new ServiceCollection();
        services.AddSingleton<IAppDbContext>(db);
        services.AddSingleton<IFileStorageProvider>(storage);
        services.AddSingleton<IAppSettings>(new TestAppSettings { RecycleBinRetentionDays = 90 });
        var provider = services.BuildServiceProvider();

        var purge = new RecycleBinPurgeService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<RecycleBinPurgeService>.Instance);

        using var cancellation = new CancellationTokenSource();
        var task = purge.StartAsync(cancellation.Token);
        await Task.Delay(500);
        cancellation.Cancel();
        await task;

        Assert.Empty(db.Documents.IgnoreQueryFilters().Where(d => d.Name == "stale.txt"));
        Assert.NotEmpty(db.Documents.IgnoreQueryFilters().Where(d => d.Name == "fresh.txt"));
        Assert.Contains($"key/{stale.Id}", storage.Deleted);
        Assert.DoesNotContain($"key/{fresh.Id}", storage.Deleted);
    }

    private static Document NewDocument(AppDbContext db, Guid libraryId, string name, DateTimeOffset deletedAt)
    {
        var document = new Document
        {
            LibraryId = libraryId,
            Name = name,
            ContentType = "text/plain",
        };
        document.SetCreator(Guid.NewGuid());
        document.MarkDeleted(Guid.NewGuid(), deletedAt);
        return document;
    }

    private sealed class RecordingStorage : IFileStorageProvider
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
