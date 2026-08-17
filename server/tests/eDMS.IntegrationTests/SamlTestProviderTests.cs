using System.Net;
using DotNet.Testcontainers.Containers;

namespace eDMS.IntegrationTests;

/// <summary>
/// Verifies that the pinned SAML IdP image starts with usable metadata. Docker-less
/// developer machines skip the container-backed check; CI runs it with Docker.
/// </summary>
public sealed class SamlTestProviderTests : IAsyncLifetime
{
    private IContainer? container;
    private SamlTestProvider? provider;
    private bool available;
    private Exception? startupException;

    public async Task InitializeAsync()
    {
        try
        {
            provider = SamlTestProvider.Create();
            container = provider.CreateBuilder().Build();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            await container.StartAsync(timeout.Token);
            available = true;
        }
        catch (Exception exception)
        {
            available = false;
            startupException = exception;
        }
    }

    public async Task DisposeAsync()
    {
        if (container is not null)
        {
            await container.DisposeAsync();
        }

        provider?.Dispose();
    }

    [Fact]
    public async Task Exposes_the_configured_signed_idp_metadata()
    {
        if (!available)
        {
            if (string.Equals(
                    Environment.GetEnvironmentVariable("CI"),
                    "true",
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"The SAML Testcontainer could not start on CI: {startupException}",
                    startupException);
            }

            return;
        }

        using var client = new HttpClient(new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
        });
        var baseAddress =
            $"https://{container!.Hostname}:{container.GetMappedPublicPort(443)}";
        using var response = await client.GetAsync(
            $"{baseAddress}/simplesaml/saml2/idp/metadata.php");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var metadata = await response.Content.ReadAsStringAsync();
        Assert.Contains(SamlTestProvider.EntityId, metadata, StringComparison.Ordinal);
        Assert.Contains("HTTP-Redirect", metadata, StringComparison.Ordinal);
        Assert.True(File.Exists(Path.Combine(provider!.SharedDirectory, "server.crt")));
    }
}
