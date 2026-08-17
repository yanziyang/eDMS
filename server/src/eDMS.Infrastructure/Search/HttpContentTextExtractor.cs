using System.Net.Http.Headers;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Search;

/// <summary>
/// Calls Apache Tika Server's text endpoint over HTTP. The heavyweight parser
/// stays outside the API process (ADR-13); failures return null so the
/// background indexer can retry without losing the document's pending state.
/// </summary>
public sealed class HttpContentTextExtractor(
    HttpClient httpClient,
    IOptions<TextExtractionOptions> options,
    ILogger<HttpContentTextExtractor> logger) : IContentTextExtractor
{
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".doc", ".docm", ".docx", ".dot", ".dotm", ".dotx",
        ".odp", ".ods", ".odt",
        ".pdf",
        ".pot", ".potm", ".potx", ".pps", ".ppsm", ".ppsx", ".ppt", ".pptm", ".pptx",
        ".xls", ".xlsb", ".xlsm", ".xlsx", ".xlt", ".xltm", ".xltx",
    };

    private static readonly HashSet<string> SupportedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        "application/vnd.openxmlformats-officedocument.presentationml.template",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
        "application/vnd.oasis.opendocument.presentation",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.text",
    };

    public async Task<string?> ExtractAsync(
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        if (!IsSupported(fileName, contentType))
        {
            return string.Empty;
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Put,
            new Uri(new Uri(options.Value.BaseUrl.TrimEnd('/') + "/"), "tika"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain"));

        var fileContent = new StreamContent(content);
        fileContent.Headers.ContentType = MediaTypeHeaderValue.TryParse(contentType, out var mediaType)
            ? mediaType
            : new MediaTypeHeaderValue("application/octet-stream");
        request.Content = fileContent;

        try
        {
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Content text extraction failed with status {Status} for {File}.",
                    response.StatusCode,
                    fileName);
                return null;
            }

            var extracted = await response.Content.ReadAsStringAsync(cancellationToken);
            var maxCharacters = Math.Max(1, options.Value.MaxCharacters);
            return extracted.Length <= maxCharacters
                ? extracted
                : extracted[..maxCharacters];
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Content text extraction timed out for {File}.", fileName);
            return null;
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Content text extraction request failed for {File}.", fileName);
            return null;
        }
    }

    internal static bool IsSupported(string fileName, string contentType)
    {
        var normalizedContentType = contentType.Split(';', 2)[0].Trim();
        return SupportedContentTypes.Contains(normalizedContentType)
            || SupportedExtensions.Contains(Path.GetExtension(fileName));
    }
}
