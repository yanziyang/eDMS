using System.Net;
using System.Net.Http.Json;
using eDMS.Application.Documents;
using eDMS.Application.Uploads;

namespace eDMS.IntegrationTests;

public sealed class ChunkedUploadApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ChunkedUploadApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task Chunked_upload_roundtrip_creates_the_document()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var content = System.Text.Encoding.UTF8.GetBytes("chunked upload content that spans multiple chunks");
        var session = await StartAsync(client, libraryId, "big.txt", content.Length);

        var chunkSize = 10;
        for (var offset = 0; offset < content.Length; offset += chunkSize)
        {
            var chunk = content[offset..Math.Min(offset + chunkSize, content.Length)];
            var response = await client.PutAsync(
                $"/api/v1/uploads/{session.SessionId}/chunks?offset={offset}",
                new ByteArrayContent(chunk));
            response.EnsureSuccessStatusCode();
            var status = await response.Content.ReadFromJsonAsync<UploadSessionDto>();
            Assert.Equal(Math.Min(offset + chunk.Length, content.Length), status!.UploadedBytes);
        }

        var complete = await client.PostAsJsonAsync(
            $"/api/v1/uploads/{session.SessionId}/complete",
            new { metadata = (object?)null });
        Assert.Equal(HttpStatusCode.OK, complete.StatusCode);
        var result = await complete.Content.ReadFromJsonAsync<UploadResult>();
        Assert.Equal("big.txt", result!.Name);
        Assert.Equal("1.0", result.VersionLabel);

        var download = await client.GetAsync($"/api/v1/documents/{result.DocumentId}/download");
        Assert.Equal(System.Text.Encoding.UTF8.GetString(content), await download.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Chunk_offsets_must_continue_exactly()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var content = new byte[100];
        var session = await StartAsync(client, libraryId, "ordered.txt", content.Length);

        var first = await client.PutAsync(
            $"/api/v1/uploads/{session.SessionId}/chunks?offset=0",
            new ByteArrayContent(content[..10]));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var skipAhead = await client.PutAsync(
            $"/api/v1/uploads/{session.SessionId}/chunks?offset=50",
            new ByteArrayContent(content[50..60]));
        await TestSupport.AssertProblemAsync(skipAhead, HttpStatusCode.Conflict);

        var rewind = await client.PutAsync(
            $"/api/v1/uploads/{session.SessionId}/chunks?offset=0",
            new ByteArrayContent(content[..10]));
        await TestSupport.AssertProblemAsync(rewind, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Resume_reports_progress_and_complete_requires_chunks()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var content = new byte[100];
        var session = await StartAsync(client, libraryId, "resume.txt", content.Length);

        await client.PutAsync(
            $"/api/v1/uploads/{session.SessionId}/chunks?offset=0",
            new ByteArrayContent(content[..40]));

        // Simulated interruption: a fresh status call reports the continuation point.
        var status = await (await client.GetAsync($"/api/v1/uploads/{session.SessionId}"))
            .Content.ReadFromJsonAsync<UploadSessionDto>();
        Assert.Equal(40, status!.UploadedBytes);

        // Complete with zero chunks -> conflict.
        var emptySession = await StartAsync(client, libraryId, "empty.txt", 10);
        var completeEmpty = await client.PostAsJsonAsync(
            $"/api/v1/uploads/{emptySession.SessionId}/complete",
            new { metadata = (object?)null });
        await TestSupport.AssertProblemAsync(completeEmpty, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Abort_removes_the_session()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var session = await StartAsync(client, libraryId, "abort.txt", 100);
        await client.PutAsync(
            $"/api/v1/uploads/{session.SessionId}/chunks?offset=0",
            new ByteArrayContent(new byte[10]));

        var abort = await client.DeleteAsync($"/api/v1/uploads/{session.SessionId}");
        Assert.Equal(HttpStatusCode.NoContent, abort.StatusCode);

        var status = await client.GetAsync($"/api/v1/uploads/{session.SessionId}");
        await TestSupport.AssertProblemAsync(status, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Upload_sessions_require_permission()
    {
        var adminEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, adminEmail, "Password1!", isAdmin: true);
        var (adminToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), adminEmail, "Password1!");
        using var admin = TestSupport.AuthorizedClient(_factory, adminToken);
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(admin);

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);

        var start = await other.PostAsJsonAsync(
            "/api/v1/uploads",
            new { libraryId, folderId = (Guid?)null, fileName = "x.txt", totalBytes = 10L });
        await TestSupport.AssertProblemAsync(start, HttpStatusCode.Forbidden);
    }

    private static async Task<UploadSessionDto> StartAsync(
        HttpClient client,
        Guid libraryId,
        string fileName,
        int totalBytes)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/uploads",
            new { libraryId, folderId = (Guid?)null, fileName, totalBytes });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<UploadSessionDto>()
            ?? throw new InvalidOperationException("No session returned.");
    }
}
