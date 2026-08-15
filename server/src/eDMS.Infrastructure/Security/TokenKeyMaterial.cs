using System.Security.Cryptography;
using eDMS.Infrastructure.Options;
using Microsoft.IdentityModel.Tokens;

namespace eDMS.Infrastructure.Security;

/// <summary>
/// Holds the RSA key material used both to sign access tokens and to validate them.
/// A single instance is shared so the development fallback key (generated when no
/// Jwt:PrivateKey is configured) signs and validates with the same keypair.
/// </summary>
public sealed class TokenKeyMaterial
{
    public RsaSecurityKey SigningKey { get; }

    public RsaSecurityKey ValidationKey { get; }

    public TokenKeyMaterial(JwtOptions options)
    {
        var rsa = RSA.Create();
        if (!string.IsNullOrWhiteSpace(options.PrivateKey))
        {
            rsa.ImportFromPem(options.PrivateKey);
        }
        else
        {
            rsa = RSA.Create(2048);
        }

        SigningKey = new RsaSecurityKey(rsa);

        if (!string.IsNullOrWhiteSpace(options.PublicKey))
        {
            var publicRsa = RSA.Create();
            publicRsa.ImportFromPem(options.PublicKey);
            ValidationKey = new RsaSecurityKey(publicRsa);
        }
        else
        {
            ValidationKey = new RsaSecurityKey(rsa.ExportParameters(includePrivateParameters: false));
        }
    }
}
