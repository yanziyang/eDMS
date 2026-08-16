using System.Net.Http.Headers;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Office;

/// <summary>
/// Calls the LibreOffice-headless converter container (M13.1) over HTTP. Failures
/// are logged and surfaced as null so the preview endpoint falls back to the
/// original bytes instead of breaking the request.
/// </summary>
public sealed class HttpOfficeConversionService(
    HttpClient httpClient,
    IOptions<OfficeConversionOptions> options,
    ILogger<HttpOfficeConversionService> logger) : IOfficeConversionService
{
    public async Task<Stream?> ConvertToPdfAsync(
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(new Uri(options.Value.BaseUrl.TrimEnd('/') + "/"), "convert"));
        using var multipart = new MultipartFormDataContent();
        var fileContent = new StreamContent(content);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        multipart.Add(fileContent, "file", fileName);
        request.Content = multipart;

        try
        {
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Office conversion failed with status {Status}: {Body}",
                    response.StatusCode,
                    await response.Content.ReadAsStringAsync(cancellationToken));
                return null;
            }

            // Buffer so the returned stream outlives the response message.
            await using var pdfStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var buffer = new MemoryStream();
            await pdfStream.CopyToAsync(buffer, cancellationToken);
            buffer.Position = 0;
            return buffer;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Office conversion request failed for {File}.", fileName);
            return null;
        }
    }
}
