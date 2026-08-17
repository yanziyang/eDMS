using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace eDMS.Infrastructure.Search;

/// <summary>
/// Processes a bounded batch of documents whose current version is not yet
/// represented in <c>extracted_text</c>. A transient storage or Tika failure
/// leaves the version mismatch intact so a later pass retries it.
/// </summary>
public sealed class ContentTextIndexer(
    IAppDbContext db,
    IFileStorageProvider storage,
    IContentTextExtractor extractor,
    ILogger<ContentTextIndexer> logger)
{
    internal const int BatchSize = 10;

    public async Task<int> IndexPendingAsync(CancellationToken cancellationToken = default)
    {
        var pending = await db.Documents
            .Where(document => document.CurrentVersionId != null
                && document.CurrentVersionId != document.ExtractedTextVersionId)
            .OrderBy(document => document.ModifiedAt ?? document.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        var indexed = 0;
        foreach (var document in pending)
        {
            var currentVersionId = document.CurrentVersionId;
            if (currentVersionId is null)
            {
                continue;
            }

            var version = await db.DocumentVersions
                .AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == currentVersionId.Value, cancellationToken);
            if (version is null)
            {
                logger.LogWarning(
                    "Document {DocumentId} references missing current version {VersionId}; leaving it pending.",
                    document.Id,
                    currentVersionId);
                continue;
            }

            try
            {
                await using var content = await storage.OpenReadAsync(version.StorageKey, cancellationToken);
                var extracted = await extractor.ExtractAsync(
                    document.Name,
                    document.ContentType,
                    content,
                    cancellationToken);
                if (extracted is null)
                {
                    continue;
                }

                document.ExtractedText = extracted;
                document.ExtractedTextVersionId = version.Id;
                indexed++;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Content text indexing failed for document {DocumentId}; it will be retried.",
                    document.Id);
            }
        }

        if (indexed > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return indexed;
    }
}
