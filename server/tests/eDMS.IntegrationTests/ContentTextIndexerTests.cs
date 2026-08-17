using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Search;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace eDMS.IntegrationTests;

public sealed class ContentTextIndexerTests
{
    [Fact]
    public async Task IndexPendingAsync_persists_text_and_marks_the_current_version()
    {
        await using var db = CreateDb();
        var (document, version) = await SeedDocumentAsync(db, "report.pdf", "application/pdf", "report.pdf");
        var storage = new FakeStorage(new Dictionary<string, byte[]>
        {
            [version.StorageKey] = "pdf bytes"u8.ToArray(),
        });
        var extractor = new FixedExtractor("phrase only in the PDF body");
        var indexer = new ContentTextIndexer(
            db,
            storage,
            extractor,
            NullLogger<ContentTextIndexer>.Instance);

        var indexed = await indexer.IndexPendingAsync();

        Assert.Equal(1, indexed);
        var saved = await db.Documents.AsNoTracking().SingleAsync(item => item.Id == document.Id);
        Assert.Equal("phrase only in the PDF body", saved.ExtractedText);
        Assert.Equal(version.Id, saved.ExtractedTextVersionId);
        Assert.Equal(0, await indexer.IndexPendingAsync());
    }

    [Fact]
    public async Task IndexPendingAsync_leaves_failed_extraction_pending_for_retry()
    {
        await using var db = CreateDb();
        var (document, version) = await SeedDocumentAsync(db, "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "report.docx");
        var storage = new FakeStorage(new Dictionary<string, byte[]>
        {
            [version.StorageKey] = "docx bytes"u8.ToArray(),
        });
        var extractor = new FixedExtractor(null);
        var indexer = new ContentTextIndexer(
            db,
            storage,
            extractor,
            NullLogger<ContentTextIndexer>.Instance);

        Assert.Equal(0, await indexer.IndexPendingAsync());
        var pending = await db.Documents.AsNoTracking().SingleAsync(item => item.Id == document.Id);
        Assert.Null(pending.ExtractedTextVersionId);

        extractor.Result = "retry succeeded";
        Assert.Equal(1, await indexer.IndexPendingAsync());
        var completed = await db.Documents.AsNoTracking().SingleAsync(item => item.Id == document.Id);
        Assert.Equal(version.Id, completed.ExtractedTextVersionId);
        Assert.Equal("retry succeeded", completed.ExtractedText);
    }

    private static AppDbContext CreateDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private static async Task<(Document Document, DocumentVersion Version)> SeedDocumentAsync(
        AppDbContext db,
        string name,
        string contentType,
        string storageKey)
    {
        var userId = Guid.NewGuid();
        var site = new Site { Name = "Test", UrlSlug = $"test-{Guid.NewGuid():N}" };
        site.SetCreator(userId);
        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(userId);
        var document = new Document
        {
            LibraryId = library.Id,
            Name = name,
            ContentType = contentType,
            ModifiedAt = DateTimeOffset.UtcNow,
        };
        document.SetCreator(userId);
        var version = new DocumentVersion
        {
            DocumentId = document.Id,
            VersionMajor = 1,
            VersionMinor = 0,
            StorageKey = storageKey,
            Checksum = "checksum",
        };
        version.SetCreator(userId);
        document.CurrentVersionId = version.Id;

        db.Sites.Add(site);
        db.Libraries.Add(library);
        db.Documents.Add(document);
        db.DocumentVersions.Add(version);
        await db.SaveChangesAsync();
        return (document, version);
    }

    private sealed class FixedExtractor(string? result) : IContentTextExtractor
    {
        public string? Result { get; set; } = result;

        public async Task<string?> ExtractAsync(
            string fileName,
            string contentType,
            Stream content,
            CancellationToken cancellationToken = default)
        {
            using var reader = new StreamReader(content, leaveOpen: true);
            _ = await reader.ReadToEndAsync(cancellationToken);
            return Result;
        }
    }

    private sealed class FakeStorage(IReadOnlyDictionary<string, byte[]> files) : IFileStorageProvider
    {
        public Task<string> SaveAsync(Stream content, string suggestedKey, CancellationToken cancellationToken = default) =>
            Task.FromResult(suggestedKey);

        public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default) =>
            Task.FromResult<Stream>(new MemoryStream(files[storageKey], writable: false));

        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
