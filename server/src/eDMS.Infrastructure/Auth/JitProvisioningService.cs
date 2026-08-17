using eDMS.Application.Auth;
using eDMS.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Auth;

public sealed class JitProvisioningService(UserManager<ApplicationUser> userManager)
    : IJitProvisioningService
{
    public async Task<ApplicationUser?> ProvisionOrLinkAsync(
        AuthProvider provider,
        string externalId,
        string email,
        string displayName,
        CancellationToken cancellationToken = default)
    {
        if (provider == AuthProvider.Local
            || string.IsNullOrWhiteSpace(externalId)
            || string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var existingExternalUser = await userManager.Users
            .SingleOrDefaultAsync(
                user => user.AuthProvider == provider && user.ExternalId == externalId,
                cancellationToken);

        if (existingExternalUser is not null)
        {
            return existingExternalUser.IsActive ? existingExternalUser : null;
        }

        var normalizedEmail = userManager.NormalizeEmail(email.Trim());
        var localUser = await userManager.Users
            .SingleOrDefaultAsync(
                user => user.AuthProvider == AuthProvider.Local
                    && user.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (localUser is not null)
        {
            if (!localUser.IsActive)
            {
                return null;
            }

            localUser.AuthProvider = provider;
            localUser.ExternalId = externalId;
            var linkResult = await userManager.UpdateAsync(localUser);
            return linkResult.Succeeded ? localUser : null;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email.Trim(),
            Email = email.Trim(),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email.Trim() : displayName.Trim(),
            AuthProvider = provider,
            ExternalId = externalId,
            EmailConfirmed = true,
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var createResult = await userManager.CreateAsync(user);
        return createResult.Succeeded ? user : null;
    }
}
