using eDMS.Domain;

namespace eDMS.Application.Auth;

public interface IJitProvisioningService
{
    Task<ApplicationUser?> ProvisionOrLinkAsync(
        AuthProvider provider,
        string externalId,
        string email,
        string displayName,
        CancellationToken cancellationToken = default);
}
