using System.Net;
using System.Text;
using eDMS.Infrastructure.Office;
using eDMS.Infrastructure.Options;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace eDMS.IntegrationTests;

public sealed class HttpOfficeConversionServiceTests
{
    [Fact]
    public async Task ConvertToPdfAsync_returns_pdf_bytes_on_success()
    {
        var handler = new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent("%PDF-fake"u8.ToArray()),
            });
        var service = Create(handler);

        using var result = await service.ConvertToPdfAsync(
            "doc.docx",
            new MemoryStream("content"u8.ToArray()));

        Assert.NotNull(result);
        using var reader = new StreamReader(result!, Encoding.UTF8);
        Assert.Equal("%PDF-fake", await reader.ReadToEndAsync());
        Assert.Single(handler.Requests);
        Assert.Equal("convert", handler.Requests[0].RequestUri!.AbsolutePath.Trim('/'));
    }

    [Fact]
    public async Task ConvertToPdfAsync_returns_null_on_http_error()
    {
        var handler = new StubHandler(
            response: new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("boom"),
            });
        var service = Create(handler);

        var result = await service.ConvertToPdfAsync("doc.docx", new MemoryStream("x"u8.ToArray()));

        Assert.Null(result);
    }

    [Fact]
    public async Task ConvertToPdfAsync_returns_null_on_network_failure()
    {
        var handler = new StubHandler(exception: new HttpRequestException("refused"));
        var service = Create(handler);

        var result = await service.ConvertToPdfAsync("doc.docx", new MemoryStream("x"u8.ToArray()));

        Assert.Null(result);
    }

    private static HttpOfficeConversionService Create(StubHandler handler) =>
        new(
            new HttpClient(handler),
            Options.Create(new OfficeConversionOptions { BaseUrl = "http://localhost:8100" }),
            NullLogger<HttpOfficeConversionService>.Instance);

    private sealed class StubHandler(HttpResponseMessage? response = null, Exception? exception = null) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            if (exception is not null)
            {
                return Task.FromException<HttpResponseMessage>(exception);
            }

            return Task.FromResult(response!);
        }
    }
}
