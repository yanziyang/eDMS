namespace eDMS.Infrastructure.Options;

public sealed class OfficeConversionOptions
{
    public const string SectionName = "OfficeConversion";

    public string BaseUrl { get; set; } = "http://localhost:8100";

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(120);
}
