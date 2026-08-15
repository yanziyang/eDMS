namespace eDMS.Infrastructure.Options;

public sealed class ClientOptions
{
    public const string SectionName = "Client";

    public string BaseUrl { get; set; } = "http://localhost:5173";
}
