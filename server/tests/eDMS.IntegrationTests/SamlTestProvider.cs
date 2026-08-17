using DotNet.Testcontainers.Builders;

namespace eDMS.IntegrationTests;

/// <summary>
/// Pinned SimpleSAMLphp IdP fixture. The image is configured from repository files
/// and generates a fresh test-only signing certificate into a host-mounted folder.
/// </summary>
internal sealed class SamlTestProvider : IDisposable
{
    public const string Image = "cirrusid/simplesamlphp:v2.5.0";
    public const string EntityId = "urn:edms:test-saml-idp";
    public const string SpEntityId = "urn:edms:saml";
    public const string DemoLogin = "student";
    public const string DemoPassword = "studentpass";
    public const string DemoEmail = "student@edms.local";
    public const string CallbackPath = "/api/v1/auth/sso/saml/acs";

    private readonly string resourceDirectory;

    private SamlTestProvider()
    {
        SharedDirectory = Path.Combine(
            Path.GetTempPath(),
            $"edms-saml-idp-{Guid.NewGuid():N}");
        Directory.CreateDirectory(SharedDirectory);
        resourceDirectory = Path.Combine(AppContext.BaseDirectory, "saml-idp");
    }

    public string SharedDirectory { get; }

    public static SamlTestProvider Create() => new();

    public ContainerBuilder CreateBuilder() =>
        new ContainerBuilder(Image)
            .WithExposedPort(443)
            .WithPortBinding(443, true)
            .WithBindMount(resourceDirectory, "/opt/edms-saml")
            .WithBindMount(
                Path.Combine(resourceDirectory, "config-override.php"),
                "/var/simplesamlphp/config/config-override.php")
            .WithBindMount(
                Path.Combine(resourceDirectory, "authsources.php"),
                "/var/simplesamlphp/config/authsources.php")
            .WithBindMount(
                Path.Combine(resourceDirectory, "saml20-idp-hosted.php"),
                "/var/simplesamlphp/metadata/saml20-idp-hosted.php")
            .WithBindMount(
                Path.Combine(resourceDirectory, "saml20-sp-remote.php"),
                "/var/simplesamlphp/metadata/saml20-sp-remote.php")
            .WithBindMount(SharedDirectory, "/shared")
            .WithEntrypoint("bash", "/opt/edms-saml/entrypoint.sh")
            .WithEnvironment("SSP_ADMIN_PASSWORD", "secret1")
            .WithEnvironment("SSP_SECRET_SALT", "edms-saml-test-secret")
            .WithEnvironment("SSP_APACHE_ALIAS", "simplesaml/")
            .WithEnvironment("APACHE_CERT_NAME", "local-stack-dev")
            .WithWaitStrategy(
                Wait.ForUnixContainer()
                    .UntilHttpRequestIsSucceeded(
                        request => request
                            .ForPort(443)
                            .ForPath("/simplesaml/saml2/idp/metadata.php")
                            .UsingTls()
                            .UsingHttpMessageHandler(new HttpClientHandler
                            {
                                ServerCertificateCustomValidationCallback =
                                    HttpClientHandler
                                        .DangerousAcceptAnyServerCertificateValidator,
                            })
                            .ForStatusCode(System.Net.HttpStatusCode.OK),
                        wait => wait.WithTimeout(TimeSpan.FromMinutes(2))));

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(SharedDirectory))
            {
                Directory.Delete(SharedDirectory, recursive: true);
            }
        }
        catch (IOException)
        {
            // Test fixture cleanup is best-effort on Windows while Docker still has
            // a transient handle to the bind-mounted directory.
        }
    }
}
