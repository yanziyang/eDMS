using System.Net;
using System.Net.Mail;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Email;

/// <summary>
/// SMTP-backed email sender. Delivery failures are logged rather than thrown so a
/// mail outage does not break the surrounding request.
/// </summary>
public sealed class EmailSender(
    IOptions<SmtpOptions> options,
    ILogger<EmailSender> logger) : IEmailSender
{
    public async Task SendAsync(
        string to,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken = default)
    {
        var settings = options.Value;

        try
        {
            using var client = new SmtpClient(settings.Host, settings.Port)
            {
                EnableSsl = settings.EnableSsl,
            };

            if (!string.IsNullOrWhiteSpace(settings.Username))
            {
                client.Credentials = new NetworkCredential(settings.Username, settings.Password);
            }

            using var message = new MailMessage(settings.From, to, subject, htmlBody)
            {
                IsBodyHtml = true,
            };

            await client.SendMailAsync(message, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Failed to send email to {To}.", to);
        }
    }
}
