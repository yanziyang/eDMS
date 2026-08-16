using eDMS.Domain;

namespace eDMS.Application.Admin;

public sealed record AuditLogDto(
    Guid Id,
    DateTimeOffset Timestamp,
    Guid UserId,
    string Action,
    string ObjectType,
    Guid ObjectId,
    string ObjectName,
    Guid? SiteId,
    string? IpAddress);

public sealed record StorageReportDto(Guid SiteId, string SiteName, long UsedBytes);

public sealed record AdminSettingsDto(
    long MaxUploadSizeBytes,
    int RecycleBinRetentionDays,
    bool SiteCreationRestricted,
    int AccessTokenLifetimeMinutes,
    int RefreshTokenLifetimeDays,
    string AppName);

public sealed record UpdateAdminSettingsRequest(
    long? MaxUploadSizeBytes,
    int? RecycleBinRetentionDays,
    bool? SiteCreationRestricted);

public interface IAdminService
{
    Task<IReadOnlyList<AuditLogDto>> ListAuditLogAsync(
        Guid? siteId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StorageReportDto>> GetStorageReportAsync(CancellationToken cancellationToken = default);

    Task<AdminSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default);

    Task UpdateSettingsAsync(
        UpdateAdminSettingsRequest request,
        CancellationToken cancellationToken = default);
}
