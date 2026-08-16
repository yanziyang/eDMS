namespace eDMS.Domain;

/// <summary>
/// A global, admin-editable application setting (FR-ADMIN-04). Stored as a key/value
/// row; runtime consumers read through <c>IAppSettings</c>, which caches values and
/// invalidates on update.
/// </summary>
public sealed class AppSetting
{
    public string Key { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}

public static class AppSettingKeys
{
    public const string MaxUploadSizeBytes = "max_upload_size_bytes";

    public const string RecycleBinRetentionDays = "recycle_bin_retention_days";

    public const string SiteCreationRestricted = "site_creation_restricted";
}
