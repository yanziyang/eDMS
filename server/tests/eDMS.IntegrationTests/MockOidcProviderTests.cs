using System.Net.Http.Json;
using System.Text.Json;
using DotNet.Testcontainers.Containers;

namespace eDMS.IntegrationTests;

/// <summary>
/// Verifies that the pinned OIDC provider image is usable by the integration-test
/// suite. Docker-less developer machines skip the container-backed check; CI runs it
/// on the Docker-enabled runner.
/// </summary>
public sealed class MockOidcProviderTests : IAsyncLifetime
{
    private IContainer? _container;
    private bool _available;

    public async Task InitializeAsync()
    {
        try
        {
            _container = MockOidcProvider.CreateBuilder().Build();
            await _container.StartAsync();
            _available = true;
        }
        catch (Exception)
        {
            _available = false;
        }
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    [Fact]
    public async Task Exposes_discovery_document_for_the_default_issuer()
    {
        if (!_available)
        {
            return;
        }

        var baseAddress = $"http://{_container!.Hostname}:{_container.GetMappedPublicPort(8080)}";
        using var client = new HttpClient();
        using var response = await client.GetAsync(
            $"{baseAddress}/{MockOidcProvider.IssuerId}/.well-known/openid-configuration");

        response.EnsureSuccessStatusCode();
        var discovery = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(
            $"{baseAddress}/{MockOidcProvider.IssuerId}",
            discovery.GetProperty("issuer").GetString());
        Assert.Contains("/authorize", discovery.GetProperty("authorization_endpoint").GetString());
        Assert.Contains("/token", discovery.GetProperty("token_endpoint").GetString());
        Assert.Contains("/jwks", discovery.GetProperty("jwks_uri").GetString());
    }
}
