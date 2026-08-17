using eDMS.Infrastructure.Search;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace eDMS.Infrastructure.Background;

/// <summary>
/// Periodically indexes persisted document versions. The upload/check-in path
/// only changes <c>CurrentVersionId</c>; this worker keeps the request latency
/// independent of PDF/Office parsing time (M17.2, ADR-13).
/// </summary>
public sealed class ContentTextIndexingService(
    IServiceScopeFactory scopeFactory,
    ILogger<ContentTextIndexingService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var indexer = scope.ServiceProvider.GetRequiredService<ContentTextIndexer>();
                await indexer.IndexPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Content text indexing pass failed.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
