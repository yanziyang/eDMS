using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Background;

public sealed class RecycleBinPurgeService(
    IServiceScopeFactory scopeFactory,
    IOptions<RecycleBinOptions> options,
    ILogger<RecycleBinPurgeService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeAsync(stoppingToken);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Recycle bin purge failed.");
            }

            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }

    private async Task PurgeAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IFileStorageProvider>();
        var cutoff = DateTimeOffset.UtcNow.AddDays(-options.Value.RetentionDays);

        var expiredDocuments = await db.Documents.IgnoreQueryFilters()
            .Where(document => document.IsDeleted && document.DeletedAt != null && document.DeletedAt < cutoff)
            .ToListAsync(cancellationToken);

        foreach (var document in expiredDocuments)
        {
            var versions = await db.DocumentVersions
                .Where(version => version.DocumentId == document.Id)
                .ToListAsync(cancellationToken);
            foreach (var version in versions)
            {
                await storage.DeleteAsync(version.StorageKey, cancellationToken);
            }
            db.Documents.Remove(document);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
