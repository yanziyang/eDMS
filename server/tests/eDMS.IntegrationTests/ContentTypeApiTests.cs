using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using eDMS.Application.Admin;
using eDMS.Domain;

namespace eDMS.IntegrationTests;

public sealed class ContentTypeApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions ApiJsonOptions = new(JsonSerializerOptions.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public ContentTypeApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task Content_type_lifecycle_with_columns()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var create = await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "Contract", description = "Legal docs", libraryId });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var typeId = Guid.Parse((await create.Content.ReadAsStringAsync()).Trim('"'));

        var addColumn = await client.PostAsJsonAsync(
            $"/api/v1/admin/content-types/{typeId}/columns",
            new
            {
                name = "Counterparty",
                dataType = ColumnDataType.Text,
                isRequired = true,
                choiceOptions = (string?)null,
                defaultValue = (string?)null,
            });
        Assert.Equal(HttpStatusCode.Created, addColumn.StatusCode);
        var columnId = Guid.Parse((await addColumn.Content.ReadAsStringAsync()).Trim('"'));

        var updateColumn = await client.PutAsJsonAsync(
            $"/api/v1/admin/columns/{columnId}",
            new
            {
                name = "Counterparty",
                dataType = ColumnDataType.Choice,
                isRequired = true,
                choiceOptions = "[\"Acme\",\"Globex\"]",
                defaultValue = "Acme",
            });
        Assert.Equal(HttpStatusCode.NoContent, updateColumn.StatusCode);

        var list = await (await client.GetAsync($"/api/v1/admin/content-types?libraryId={libraryId}"))
            .Content.ReadFromJsonAsync<List<ContentTypeDto>>(ApiJsonOptions);
        var listed = Assert.Single(list!);
        Assert.Equal("Contract", listed.Name);
        var column = Assert.Single(listed.Columns);
        Assert.Equal(ColumnDataType.Choice, column.DataType);
        Assert.True(column.IsRequired);

        var updateType = await client.PutAsJsonAsync(
            $"/api/v1/admin/content-types/{typeId}",
            new { name = "Contract v2", description = "Updated", libraryId });
        Assert.Equal(HttpStatusCode.NoContent, updateType.StatusCode);

        var deleteColumn = await client.DeleteAsync($"/api/v1/admin/columns/{columnId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteColumn.StatusCode);

        var deleteType = await client.DeleteAsync($"/api/v1/admin/content-types/{typeId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteType.StatusCode);
    }

    [Fact]
    public async Task Content_type_error_paths()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var invalid = await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "", description = (string?)null, libraryId });
        await TestSupport.AssertProblemAsync(invalid, HttpStatusCode.BadRequest);

        var typeId = Guid.Parse((await (await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "Type", description = (string?)null, libraryId })).Content.ReadAsStringAsync()).Trim('"'));

        var duplicate = await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "Type", description = (string?)null, libraryId });
        await TestSupport.AssertProblemAsync(duplicate, HttpStatusCode.Conflict);

        var duplicateColumn = await client.PostAsJsonAsync(
            $"/api/v1/admin/content-types/{typeId}/columns",
            new { name = "Col", dataType = ColumnDataType.Text, isRequired = false });
        Assert.Equal(HttpStatusCode.Created, duplicateColumn.StatusCode);
        var again = await client.PostAsJsonAsync(
            $"/api/v1/admin/content-types/{typeId}/columns",
            new { name = "Col", dataType = ColumnDataType.Text, isRequired = false });
        await TestSupport.AssertProblemAsync(again, HttpStatusCode.Conflict);

        var columnOnMissingType = await client.PostAsJsonAsync(
            $"/api/v1/admin/content-types/{Guid.NewGuid()}/columns",
            new { name = "X", dataType = ColumnDataType.Text, isRequired = false });
        await TestSupport.AssertProblemAsync(columnOnMissingType, HttpStatusCode.NotFound);

        var deleteUnknown = await client.DeleteAsync($"/api/v1/admin/content-types/{Guid.NewGuid()}");
        await TestSupport.AssertProblemAsync(deleteUnknown, HttpStatusCode.NotFound);

        var updateUnknown = await client.PutAsJsonAsync(
            $"/api/v1/admin/columns/{Guid.NewGuid()}",
            new { name = "X", dataType = ColumnDataType.Text, isRequired = false });
        await TestSupport.AssertProblemAsync(updateUnknown, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Content_type_in_use_cannot_be_deleted()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);
        var typeId = Guid.Parse((await (await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "Used", description = (string?)null, libraryId })).Content.ReadAsStringAsync()).Trim('"'));

        await TestSupport.UploadAsync(client, libraryId, "doc.txt", "v1");

        var deleteType = await client.DeleteAsync($"/api/v1/admin/content-types/{typeId}");
        await TestSupport.AssertProblemAsync(deleteType, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Required_columns_block_upload_and_checkin_until_filled()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        var typeId = Guid.Parse((await (await client.PostAsJsonAsync(
            "/api/v1/admin/content-types",
            new { name = "Strict", description = (string?)null, libraryId })).Content.ReadAsStringAsync()).Trim('"'));
        var requiredColumnId = Guid.Parse((await (await client.PostAsJsonAsync(
            $"/api/v1/admin/content-types/{typeId}/columns",
            new { name = "Required", dataType = ColumnDataType.Text, isRequired = true })).Content.ReadAsStringAsync()).Trim('"'));

        // Upload without metadata -> blocked.
        using var blockedMultipart = new MultipartFormDataContent();
        blockedMultipart.Add(new ByteArrayContent("x"u8.ToArray()), "file", "blocked.txt");
        var blocked = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", blockedMultipart);
        await TestSupport.AssertProblemAsync(blocked, HttpStatusCode.Conflict);

        // Upload with the required value -> ok, and the doc carries the content type.
        using var okMultipart = new MultipartFormDataContent();
        okMultipart.Add(new ByteArrayContent("x"u8.ToArray()), "file", "ok.txt");
        okMultipart.Add(new StringContent(System.Text.Json.JsonSerializer.Serialize(
            new[] { new { columnDefinitionId = requiredColumnId, value = "Acme" } },
            System.Text.Json.JsonSerializerOptions.Web)), "metadata");
        var ok = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", okMultipart);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var uploadResult = await ok.Content.ReadFromJsonAsync<eDMS.Application.Documents.UploadResult>();
        var documentId = uploadResult!.DocumentId;

        var metadata = await (await client.GetAsync($"/api/v1/documents/{documentId}/metadata"))
            .Content.ReadFromJsonAsync<DocumentMetadataDto>(ApiJsonOptions);
        Assert.Equal(typeId, metadata!.ContentTypeId);
        Assert.Equal("Strict", metadata.ContentTypeName);
        var column = Assert.Single(metadata.Columns);
        Assert.Equal("Acme", column.Value);

        // Check-in of an out-of-date document without the required value -> blocked.
        await client.PostAsync($"/api/v1/documents/{documentId}/checkout", null);
        await client.PutAsJsonAsync(
            $"/api/v1/documents/{documentId}/metadata-values",
            new { values = new object[] { new { columnDefinitionId = requiredColumnId, value = "" } } });
        var checkin = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/checkin",
            new { comment = "done" });
        await TestSupport.AssertProblemAsync(checkin, HttpStatusCode.Conflict);

        await client.PutAsJsonAsync(
            $"/api/v1/documents/{documentId}/metadata-values",
            new { values = new object[] { new { columnDefinitionId = requiredColumnId, value = "Globex" } } });
        var checkinOk = await client.PostAsJsonAsync(
            $"/api/v1/documents/{documentId}/checkin",
            new { comment = "done" });
        Assert.Equal(HttpStatusCode.NoContent, checkinOk.StatusCode);
    }

    [Fact]
    public async Task Content_type_endpoints_require_system_admin()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/admin/content-types")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(
                "/api/v1/admin/content-types",
                new { name = "X", description = (string?)null, libraryId = (Guid?)null })).StatusCode);
    }
}
