using System.Net;
using System.Text;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Search;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class HttpContentTextExtractorTests
{
    [Fact]
    public async Task ExtractAsync_returns_tika_text_for_supported_content()
    {
        var handler = new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("body-only phrase"),
            });
        var service = Create(handler);

        var result = await service.ExtractAsync(
            "report.pdf",
            "application/pdf",
            new MemoryStream("pdf-bytes"u8.ToArray()));

        Assert.Equal("body-only phrase", result);
        Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Put, handler.Requests[0].Method);
        Assert.Equal("tika", handler.Requests[0].RequestUri!.AbsolutePath.Trim('/'));
        Assert.Equal("pdf-bytes", handler.Bodies[0]);
        Assert.Equal("text/plain", handler.Requests[0].Headers.Accept.Single().MediaType);
    }

    [Fact]
    public async Task ExtractAsync_returns_empty_without_calling_tika_for_unsupported_content()
    {
        var handler = new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("should not be used"),
            });
        var service = Create(handler);

        var result = await service.ExtractAsync(
            "notes.txt",
            "text/plain",
            new MemoryStream("plain text"u8.ToArray()));

        Assert.Equal(string.Empty, result);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task ExtractAsync_returns_null_on_http_error_or_network_failure()
    {
        var errorService = Create(new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)));

        var error = await errorService.ExtractAsync(
            "report.docx",
            "application/octet-stream",
            new MemoryStream("docx"u8.ToArray()));

        Assert.Null(error);

        var networkService = Create(new StubHandler(exception: new HttpRequestException("refused")));
        var network = await networkService.ExtractAsync(
            "report.docx",
            "application/octet-stream",
            new MemoryStream("docx"u8.ToArray()));

        Assert.Null(network);
    }

    [Fact]
    public async Task ExtractAsync_applies_the_configured_character_limit()
    {
        var handler = new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("0123456789"),
            });
        var service = new HttpContentTextExtractor(
            new HttpClient(handler),
            Options.Create(new TextExtractionOptions
            {
                BaseUrl = "http://localhost:9998",
                MaxCharacters = 5,
            }),
            NullLogger<HttpContentTextExtractor>.Instance);

        var result = await service.ExtractAsync(
            "report.pdf",
            "application/pdf",
            new MemoryStream("pdf"u8.ToArray()));

        Assert.Equal("01234", result);
    }

    private static HttpContentTextExtractor Create(StubHandler handler) =>
        new(
            new HttpClient(handler),
            Options.Create(new TextExtractionOptions { BaseUrl = "http://localhost:9998" }),
            NullLogger<HttpContentTextExtractor>.Instance);

    private sealed class StubHandler(HttpResponseMessage? response = null, Exception? exception = null) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        public List<string> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            if (request.Content is not null)
            {
                Bodies.Add(await request.Content.ReadAsStringAsync(cancellationToken));
            }

            if (exception is not null)
            {
                return await Task.FromException<HttpResponseMessage>(exception);
            }

            return response!;
        }
    }
}
