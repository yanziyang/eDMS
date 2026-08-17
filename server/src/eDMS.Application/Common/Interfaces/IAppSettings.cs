namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Reads the global, admin-editable application settings (FR-ADMIN-04). Implementations
/// fall back to configured defaults when no admin override exists and cache lookups
/// briefly for request-path performance.
/// </summary>
public interface IAppSettings
{
    Task<long> GetMaxUploadSizeBytesAsync(CancellationToken cancellationToken = default);

    Task<int> GetRecycleBinRetentionDaysAsync(CancellationToken cancellationToken = default);

    Task<bool> GetSiteCreationRestrictedAsync(CancellationToken cancellationToken = default);

    Task<bool> GetSsoEnforcedGloballyAsync(CancellationToken cancellationToken = default);

    Task UpsertAsync(
        IReadOnlyCollection<(string Key, string Value)> updates,
        CancellationToken cancellationToken = default);
}
