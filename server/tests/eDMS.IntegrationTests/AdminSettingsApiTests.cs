using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using eDMS.Application.Admin;
using eDMS.Domain;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.IntegrationTests;

public sealed class AdminSettingsApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AdminSettingsApiTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        return TestSupport.AuthorizedClient(_factory, token);
    }

    [Fact]
    public async Task Settings_roundtrip_via_put_and_get()
    {
        using var client = await AdminAsync();

        var update = await client.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new
            {
                maxUploadSizeBytes = 2_048L,
                recycleBinRetentionDays = 30,
                siteCreationRestricted = true,
            });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var updated = await (await client.GetAsync("/api/v1/admin/settings"))
            .Content.ReadFromJsonAsync<AdminSettingsDto>();
        Assert.Equal(2_048L, updated!.MaxUploadSizeBytes);
        Assert.Equal(30, updated.RecycleBinRetentionDays);
        Assert.True(updated.SiteCreationRestricted);
    }

    [Fact]
    public async Task Partial_update_keeps_other_values()
    {
        using var client = await AdminAsync();

        await client.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { maxUploadSizeBytes = 7_000L, recycleBinRetentionDays = 15, siteCreationRestricted = true });

        await client.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { maxUploadSizeBytes = 5_000L, recycleBinRetentionDays = (int?)null, siteCreationRestricted = (bool?)null });

        var updated = await (await client.GetAsync("/api/v1/admin/settings"))
            .Content.ReadFromJsonAsync<AdminSettingsDto>();
        Assert.Equal(5_000L, updated!.MaxUploadSizeBytes);
        Assert.Equal(15, updated.RecycleBinRetentionDays);
        Assert.True(updated.SiteCreationRestricted);
    }

    [Fact]
    public async Task Settings_require_system_admin()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!");
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var client = TestSupport.AuthorizedClient(_factory, token);

        var update = await client.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { maxUploadSizeBytes = 1L, recycleBinRetentionDays = (int?)null, siteCreationRestricted = (bool?)null });
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
    }

    [Fact]
    public async Task Site_creation_restriction_flag_is_enforced()
    {
        using var admin = await AdminAsync();

        var otherEmail = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, otherEmail, "Password1!");
        var (otherToken, _) = await TestSupport.LoginAsync(_factory.CreateClient(), otherEmail, "Password1!");
        using var other = TestSupport.AuthorizedClient(_factory, otherToken);

        // Default: any authenticated user may create sites (FS §16 assumption 7).
        var openCreate = await other.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = "Open Site", urlSlug = TestSupport.UniqueSlug() });
        Assert.Equal(HttpStatusCode.Created, openCreate.StatusCode);

        // Restricted: only administrators may create sites.
        await admin.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { maxUploadSizeBytes = (long?)null, recycleBinRetentionDays = (int?)null, siteCreationRestricted = true });

        var restrictedCreate = await other.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = "Blocked Site", urlSlug = TestSupport.UniqueSlug() });
        await TestSupport.AssertProblemAsync(restrictedCreate, HttpStatusCode.Forbidden);

        var adminCreate = await admin.PostAsJsonAsync(
            "/api/v1/sites",
            new { name = "Admin Site", urlSlug = TestSupport.UniqueSlug() });
        Assert.Equal(HttpStatusCode.Created, adminCreate.StatusCode);
    }

    [Fact]
    public async Task Upload_size_limit_setting_is_enforced()
    {
        using var client = await AdminAsync();
        var (_, libraryId) = await TestSupport.CreateSiteWithLibraryAsync(client);

        await client.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { maxUploadSizeBytes = 1_024L, recycleBinRetentionDays = (int?)null, siteCreationRestricted = (bool?)null });

        using var multipart = new MultipartFormDataContent();
        var big = new ByteArrayContent(new string('a', 2_048).Select(c => (byte)c).ToArray());
        multipart.Add(big, "file", "big.txt");
        var blocked = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", multipart);
        await TestSupport.AssertProblemAsync(blocked, HttpStatusCode.Conflict);

        using var smallMultipart = new MultipartFormDataContent();
        var small = new ByteArrayContent(new byte[512]);
        smallMultipart.Add(small, "file", "small.txt");
        var allowed = await client.PostAsync($"/api/v1/libraries/{libraryId}/documents", smallMultipart);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task Global_sso_enforcement_rejects_total_admin_lockout()
    {
        var email = TestSupport.UniqueEmail();
        await TestSupport.SeedUserAsync(_factory, email, "Password1!", isAdmin: true);
        var (token, _) = await TestSupport.LoginAsync(_factory.CreateClient(), email, "Password1!");
        using var admin = TestSupport.AuthorizedClient(_factory, token);

        var disableGlobal = await admin.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { ssoEnforcedGlobally = false });
        Assert.Equal(HttpStatusCode.NoContent, disableGlobal.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var admins = await userManager.Users
                .Where(user => user.IsSystemAdmin)
                .ToListAsync();
            foreach (var systemAdmin in admins)
            {
                systemAdmin.SsoExempt = false;
                await userManager.UpdateAsync(systemAdmin);
            }
        }

        var rejected = await admin.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { ssoEnforcedGlobally = true });
        Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
        using (var problem = JsonDocument.Parse(await rejected.Content.ReadAsStringAsync()))
        {
            Assert.Equal(
                "urn:edms:sso-safety-rail",
                problem.RootElement.GetProperty("type").GetString());
        }

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            Assert.NotNull(user);
            user!.SsoExempt = true;
            var result = await userManager.UpdateAsync(user);
            Assert.True(result.Succeeded);
        }

        var enabled = await admin.PutAsJsonAsync(
            "/api/v1/admin/settings",
            new { ssoEnforcedGlobally = true });
        Assert.Equal(HttpStatusCode.NoContent, enabled.StatusCode);

        var settings = await (await admin.GetAsync("/api/v1/admin/settings"))
            .Content.ReadFromJsonAsync<AdminSettingsDto>();
        Assert.True(settings!.SsoEnforcedGlobally);
    }
}
