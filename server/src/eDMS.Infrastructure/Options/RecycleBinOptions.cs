namespace eDMS.Infrastructure.Options;

public sealed class RecycleBinOptions
{
    public const string SectionName = "RecycleBin";

    public int RetentionDays { get; set; } = 90;
}
