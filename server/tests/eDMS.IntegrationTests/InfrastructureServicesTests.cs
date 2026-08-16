using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using eDMS.Api.Auth;
using eDMS.Infrastructure.Background;
using eDMS.Infrastructure.Documents;
using eDMS.Infrastructure.Email;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Security;
using eDMS.Infrastructure.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MySql.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class InfrastructureServicesTests
{
    [Fact]
    public async Task LocalDiskFileStorageProvider_roundtrip_and_delete()
    {
        var root = Path.Combine(Path.GetTempPath(), $"edms-storage-{Guid.NewGuid():N}");
        try
        {
            var provider = new LocalDiskFileStorageProvider(Options.Create(new StorageOptions { RootPath = root }));

            await provider.SaveAsync(Stream("hello"), "a/b.txt", default);

            string roundTripped;
            using (var read = await provider.OpenReadAsync("a/b.txt", default))
            using (var reader = new StreamReader(read))
            {
                roundTripped = await reader.ReadToEndAsync();
            }
            Assert.Equal("hello", roundTripped);

            await provider.DeleteAsync("a/b.txt", default);
            Assert.False(File.Exists(Path.Combine(root, "a", "b.txt")));

            await provider.DeleteAsync("missing.txt", default);

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                provider.SaveAsync(Stream("x"), "../escape.txt", default));
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }

    [Theory]
    [InlineData(new byte[] { 0x25, 0x50, 0x44, 0x46 }, "application/pdf")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png")]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "image/jpeg")]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 }, "image/gif")]
    [InlineData(new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x14, 0x00 }, "application/zip")]
    [InlineData(new byte[] { 0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00 }, "application/zip")]
    [InlineData(new byte[] { 0x00, 0x01, 0x02, 0x03 }, "application/octet-stream")]
    [InlineData(new byte[] { 0x25 }, "application/octet-stream")]
    [InlineData(new byte[0], "application/octet-stream")]
    public void ContentTypeSniffer_detects_magic_bytes(byte[] header, string expected)
    {
        Assert.Equal(expected, ContentTypeSniffer.Detect(header));
    }

    [Fact]
    public async Task EmailSender_swallows_delivery_failures()
    {
        var sender = new EmailSender(
            Options.Create(new SmtpOptions { Host = "127.0.0.1", Port = 1, From = "a@b.c" }),
            NullLogger<EmailSender>.Instance);

        await sender.SendAsync("to@example.com", "subject", "<p>body</p>", default);
    }

    [Fact]
    public void TokenKeyMaterial_generates_dev_keys_and_loads_pem_keys()
    {
        var generated = new TokenKeyMaterial(new JwtOptions { PrivateKey = "", PublicKey = "" });
        Assert.NotNull(generated.SigningKey);
        Assert.NotNull(generated.ValidationKey);

        using var rsa = RSA.Create(2048);
        var privatePem = rsa.ExportRSAPrivateKeyPem();
        var publicPem = rsa.ExportRSAPublicKeyPem();

        var loaded = new TokenKeyMaterial(new JwtOptions { PrivateKey = privatePem, PublicKey = publicPem });
        Assert.NotNull(loaded.SigningKey);
        Assert.NotNull(loaded.ValidationKey);

        Assert.Throws<ArgumentException>(() =>
            new TokenKeyMaterial(new JwtOptions { PrivateKey = "not-a-pem", PublicKey = "" }));
    }

    [Fact]
    public void CurrentUser_reads_claims_and_ip()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("is_admin", "true"),
            new Claim(ClaimTypes.Email, "user@edms.test"),
        };
        var identity = new ClaimsIdentity(claims, "test");
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(identity);
        context.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");

        var currentUser = new CurrentUser(new HttpContextAccessorStub(context));
        Assert.NotNull(currentUser.UserId);
        Assert.True(currentUser.IsSystemAdmin);
        Assert.Equal("user@edms.test", currentUser.Email);
        Assert.Equal("10.0.0.1", currentUser.IpAddress);

        var anonymous = new CurrentUser(new HttpContextAccessorStub(new DefaultHttpContext()));
        Assert.Null(anonymous.UserId);
        Assert.False(anonymous.IsSystemAdmin);
        Assert.Null(anonymous.Email);
        Assert.Null(anonymous.IpAddress);

        var malformed = new DefaultHttpContext();
        malformed.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "not-a-guid")], "test"));
        Assert.Null(new CurrentUser(new HttpContextAccessorStub(malformed)).UserId);
    }

    [Fact]
    public void RefreshTokenCookie_appends_and_clears()
    {
        var httpContext = new DefaultHttpContext();
        var response = httpContext.Response;

        RefreshTokenCookie.Append(response, "token-value", DateTimeOffset.UtcNow.AddDays(1));
        Assert.Single(response.Headers.SetCookie);

        RefreshTokenCookie.Clear(response);
        Assert.Contains(
            response.Headers.SetCookie,
            value => value!.StartsWith("edms_refresh=", StringComparison.Ordinal)
                && value.Contains("expires=Thu, 01 Jan 1970", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void AppDbContext_model_builds_for_all_four_providers()
    {
        var postgres = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=edms").Options);
        var postgresEmail = postgres.GetService<IDesignTimeModel>()
            .Model.FindEntityType(typeof(eDMS.Domain.ApplicationUser))!
            .FindProperty("Email")!;
        Assert.Equal("citext", postgresEmail.GetColumnType());

        var sqlite = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:").Options);
        var sqliteEmail = sqlite.GetService<IDesignTimeModel>()
            .Model.FindEntityType(typeof(eDMS.Domain.ApplicationUser))!
            .FindProperty("Email")!;
        Assert.Equal("NOCASE", sqliteEmail.GetCollation());

        var sqlServer = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=localhost;Database=edms;TrustServerCertificate=True").Options);
        Assert.NotNull(sqlServer.GetService<IDesignTimeModel>().Model);

        var mySql = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySQL("Server=localhost;Database=edms").Options);
        var mySqlAudit = mySql.GetService<IDesignTimeModel>()
            .Model.FindEntityType(typeof(eDMS.Domain.AuditLogEntry))!
            .FindProperty("Timestamp")!;
        Assert.NotNull(mySqlAudit.GetDefaultValueSql());
    }

    [Fact]
    public async Task OrphanedUploadSweepService_removes_only_stale_files()
    {
        var directory = Path.GetTempPath();
        var staleFile = Path.Combine(directory, $"edms-upload-{Guid.NewGuid():N}.tmp");
        var freshFile = Path.Combine(directory, $"edms-upload-{Guid.NewGuid():N}.tmp");
        try
        {
            await File.WriteAllTextAsync(staleFile, "old");
            File.SetLastWriteTimeUtc(staleFile, DateTime.UtcNow.AddDays(-2));
            await File.WriteAllTextAsync(freshFile, "new");

            using var service = new OrphanedUploadSweepService(NullLogger<OrphanedUploadSweepService>.Instance);
            using var cancellation = new CancellationTokenSource();
            var task = service.StartAsync(cancellation.Token);
            await Task.Delay(500);
            cancellation.Cancel();
            await task;

            Assert.False(File.Exists(staleFile));
            Assert.True(File.Exists(freshFile));
        }
        finally
        {
            File.Delete(staleFile);
            File.Delete(freshFile);
        }
    }

    private static Stream Stream(string content) => new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

    private sealed class HttpContextAccessorStub(HttpContext context) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = context;
    }
}
