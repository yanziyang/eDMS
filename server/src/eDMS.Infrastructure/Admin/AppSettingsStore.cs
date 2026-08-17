using eDMS.Application.Admin;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Admin;

/// <summary>
/// Cached reader for the admin-editable settings table. Admin overrides win over the
/// configured defaults; cached for 30 seconds with invalidation on every admin update.
/// </summary>
public sealed class AppSettingsStore(
    IAppDbContext db,
    IMemoryCache cache,
    IOptions<StorageOptions> storageOptions,
    IOptions<RecycleBinOptions> recycleBinOptions) : IAppSettings
{
    private long Generation => cache.GetOrCreate($"{CacheKey}:generation", static _ => 0L);

    public Task<long> GetMaxUploadSizeBytesAsync(CancellationToken cancellationToken = default) =>
        GetAsync(
            AppSettingKeys.MaxUploadSizeBytes,
            static (raw, fallback) => long.TryParse(raw, out var value) && value > 0 ? value : fallback,
            storageOptions.Value.MaxUploadSizeBytes,
            cancellationToken);

    public Task<int> GetRecycleBinRetentionDaysAsync(CancellationToken cancellationToken = default) =>
        GetAsync(
            AppSettingKeys.RecycleBinRetentionDays,
            static (raw, fallback) => int.TryParse(raw, out var value) && value > 0 ? value : fallback,
            recycleBinOptions.Value.RetentionDays,
            cancellationToken);

    public Task<bool> GetSiteCreationRestrictedAsync(CancellationToken cancellationToken = default) =>
        GetAsync(
            AppSettingKeys.SiteCreationRestricted,
            static (raw, _) => string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase),
            false,
            cancellationToken);

    public Task<bool> GetSsoEnforcedGloballyAsync(CancellationToken cancellationToken = default) =>
        GetAsync(
            AppSettingKeys.SsoEnforcedGlobally,
            static (raw, _) => string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase),
            false,
            cancellationToken);

    public async Task UpsertAsync(
        IReadOnlyCollection<(string Key, string Value)> updates,
        CancellationToken cancellationToken)
    {
        foreach (var (key, value) in updates)
        {
            var row = await db.AppSettings.SingleOrDefaultAsync(item => item.Key == key, cancellationToken);
            if (row is null)
            {
                db.AppSettings.Add(new AppSetting { Key = key, Value = value });
            }
            else
            {
                row.Value = value;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        cache.Set($"{CacheKey}:generation", Generation + 1);
    }

    private async Task<T> GetAsync<T>(
        string key,
        Func<string?, T, T> parse,
        T fallback,
        CancellationToken cancellationToken)
    {
        var raw = await cache.GetOrCreateAsync($"{CacheKey}:{Generation}:{key}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            var row = await db.AppSettings.AsNoTracking()
                .SingleOrDefaultAsync(item => item.Key == key, cancellationToken);
            return row?.Value;
        });

        return parse(raw, fallback);
    }

    private const string CacheKey = "app-settings";
}
