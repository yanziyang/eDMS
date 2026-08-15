namespace eDMS.Infrastructure.Options;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "localhost";

    public int Port { get; set; } = 1025;

    public bool EnableSsl { get; set; }

    public string From { get; set; } = "no-reply@edms.local";

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}
