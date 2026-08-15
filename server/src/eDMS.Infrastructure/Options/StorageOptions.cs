namespace eDMS.Infrastructure.Options;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string RootPath { get; set; } = "storage";

    public long MaxUploadSizeBytes { get; set; } = 262_144_000;
}
