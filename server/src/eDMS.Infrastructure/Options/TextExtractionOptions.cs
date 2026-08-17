namespace eDMS.Infrastructure.Options;

public sealed class TextExtractionOptions
{
    public const string SectionName = "TextExtraction";

    public string BaseUrl { get; set; } = "http://localhost:9998";

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(120);

    public int MaxCharacters { get; set; } = 1_000_000;
}
