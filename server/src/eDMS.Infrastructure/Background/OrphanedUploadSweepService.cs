using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace eDMS.Infrastructure.Background;

/// <summary>
/// Hourly cleanup of temp upload files that never completed a transaction (TDS §5.8):
/// single-stream temp files older than 24h, and expired chunked-upload sessions whose
/// part files are still on disk.
/// </summary>
public sealed class OrphanedUploadSweepService(ILogger<OrphanedUploadSweepService> logger) : BackgroundService
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                Sweep();
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Orphaned upload sweep failed.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private void Sweep()
    {
        var directory = Path.GetTempPath();
        var cutoff = DateTime.UtcNow - MaxAge;
        var removed = 0;

        foreach (var pattern in new[] { "edms-upload-*.tmp", "edms-chunk-*.part" })
        {
            foreach (var file in Directory.EnumerateFiles(directory, pattern))
            {
                if (File.GetLastWriteTimeUtc(file) < cutoff)
                {
                    try
                    {
                        File.Delete(file);
                        removed++;
                    }
                    catch
                    {
                        // best-effort cleanup
                    }
                }
            }
        }

        if (removed > 0)
        {
            logger.LogInformation("Removed {Count} orphaned upload temp files.", removed);
        }
    }
}
