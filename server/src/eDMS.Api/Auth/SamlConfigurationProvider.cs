using System.Security.Cryptography.X509Certificates;
using System.ServiceModel.Security;
using eDMS.Infrastructure.Options;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.Schemas;
using ITfoxtec.Identity.Saml2.Schemas.Metadata;
using Microsoft.Extensions.Options;

namespace eDMS.Api.Auth;

internal sealed class SamlConfigurationProvider(
    IOptions<SamlOptions> samlOptions,
    IHttpClientFactory httpClientFactory,
    IWebHostEnvironment environment,
    ILogger<SamlConfigurationProvider> logger)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private Saml2Configuration? configuration;

    public bool IsConfigured => samlOptions.Value.IsConfigured;

    public async Task<Saml2Configuration?> GetAsync(CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            return null;
        }

        if (configuration is not null)
        {
            return configuration;
        }

        await gate.WaitAsync(cancellationToken);
        try
        {
            configuration ??= await LoadAsync();
            return configuration;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<Saml2Configuration> LoadAsync()
    {
        var options = samlOptions.Value;
        var config = new Saml2Configuration
        {
            Issuer = options.EntityId,
            SignatureAlgorithm = Saml2SecurityAlgorithms.RsaSha256Signature,
            AudienceRestricted = true,
            SignAuthnRequest = options.SignAuthnRequest,
            CertificateValidationMode = X509CertificateValidationMode.None,
            RevocationMode = X509RevocationMode.NoCheck,
        };
        config.AllowedAudienceUris.Add(options.EntityId);

        if (!string.IsNullOrWhiteSpace(options.SigningCertificate))
        {
            config.SigningCertificate = LoadCertificate(
                options.SigningCertificate,
                options.SigningCertificatePassword);
        }

        if (config.SignAuthnRequest && config.SigningCertificate is null)
        {
            throw new InvalidOperationException(
                "Saml:SigningCertificate is required when Saml:SignAuthnRequest is true.");
        }

        if (!string.IsNullOrWhiteSpace(options.IdpMetadataUrl))
        {
            var descriptor = new EntityDescriptor();
            await descriptor.ReadIdPSsoDescriptorFromUrlAsync(
                httpClientFactory,
                new Uri(options.IdpMetadataUrl, UriKind.Absolute));

            var idpDescriptor = descriptor.IdPSsoDescriptor
                ?? throw new InvalidOperationException("The configured SAML metadata has no IdP descriptor.");
            var singleSignOnService = idpDescriptor.SingleSignOnServices
                .FirstOrDefault(service => service.Binding == ProtocolBindings.HttpRedirect)
                ?? idpDescriptor.SingleSignOnServices.FirstOrDefault()
                ?? throw new InvalidOperationException(
                    "The configured SAML metadata has no single sign-on service.");

            config.AllowedIssuer = string.IsNullOrWhiteSpace(options.IdpEntityId)
                ? descriptor.EntityId
                : options.IdpEntityId;
            config.SingleSignOnDestination = singleSignOnService.Location;

            var metadataCertificates = idpDescriptor.SigningCertificates
                .Where(certificate => certificate.IsValidLocalTime())
                .ToArray();
            if (!string.IsNullOrWhiteSpace(options.IdpSigningCertificate))
            {
                metadataCertificates =
                [
                    LoadCertificate(options.IdpSigningCertificate, string.Empty),
                ];
            }

            foreach (var certificate in metadataCertificates)
            {
                config.SignatureValidationCertificates.Add(certificate);
            }

            if (config.SignatureValidationCertificates.Count == 0)
            {
                throw new InvalidOperationException(
                    "The configured SAML metadata has no valid IdP signing certificate.");
            }

            if (idpDescriptor.WantAuthnRequestsSigned.HasValue
                && string.IsNullOrWhiteSpace(options.SigningCertificate))
            {
                config.SignAuthnRequest = idpDescriptor.WantAuthnRequestsSigned.Value;
            }
        }
        else
        {
            config.AllowedIssuer = options.IdpEntityId;
            config.SingleSignOnDestination = new Uri(options.IdpSingleSignOnUrl, UriKind.Absolute);
            config.SignatureValidationCertificates.Add(
                LoadCertificate(options.IdpSigningCertificate, string.Empty));
        }

        logger.LogInformation(
            "Configured SAML service provider {EntityId} for IdP {Issuer}.",
            config.Issuer,
            config.AllowedIssuer);
        return config;
    }

    private X509Certificate2 LoadCertificate(string path, string password)
    {
        var resolvedPath = Path.IsPathRooted(path)
            ? path
            : Path.Combine(environment.ContentRootPath, path);
#pragma warning disable SYSLIB0057
        return new X509Certificate2(
            resolvedPath,
            password,
            X509KeyStorageFlags.EphemeralKeySet | X509KeyStorageFlags.Exportable);
#pragma warning restore SYSLIB0057
    }
}
