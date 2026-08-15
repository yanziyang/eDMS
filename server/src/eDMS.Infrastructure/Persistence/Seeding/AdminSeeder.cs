using eDMS.Domain;
using eDMS.Infrastructure.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Persistence.Seeding;

public enum AdminSeedOutcome
{
    Created,
    AlreadySeeded,
    NotConfigured,
}

/// <summary>
/// Idempotently seeds one System Administrator on first run against an empty
/// database, per TDS §6.5. The administrator is created with a forced password
/// reset so the configured temporary password is not left in place.
/// </summary>
public sealed class AdminSeeder
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SeedOptions _options;
    private readonly ILogger<AdminSeeder> _logger;

    public AdminSeeder(
        UserManager<ApplicationUser> userManager,
        IOptions<SeedOptions> options,
        ILogger<AdminSeeder> logger)
    {
        _userManager = userManager;
        _options = options.Value;
        _logger = logger;
    }

    public static AdminSeedOutcome Decide(SeedOptions options, bool anyUsersExist)
    {
        if (string.IsNullOrWhiteSpace(options.AdminEmail)
            || string.IsNullOrWhiteSpace(options.AdminTempPassword))
        {
            return AdminSeedOutcome.NotConfigured;
        }

        if (anyUsersExist)
        {
            return AdminSeedOutcome.AlreadySeeded;
        }

        return AdminSeedOutcome.Created;
    }

    public async Task<AdminSeedOutcome> SeedAsync(CancellationToken cancellationToken = default)
    {
        var outcome = Decide(_options, _userManager.Users.Any());

        switch (outcome)
        {
            case AdminSeedOutcome.NotConfigured:
                _logger.LogWarning(
                    "Admin seed skipped: Seed:AdminEmail and Seed:AdminTempPassword are not both configured.");
                return outcome;

            case AdminSeedOutcome.AlreadySeeded:
                _logger.LogDebug("Admin seed skipped: users already exist.");
                return outcome;
        }

        var admin = new ApplicationUser
        {
            UserName = _options.AdminEmail,
            Email = _options.AdminEmail,
            DisplayName = "System Administrator",
            EmailConfirmed = true,
            IsActive = true,
            IsSystemAdmin = true,
            MustChangePassword = true,
            AuthProvider = AuthProvider.Local,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await _userManager.CreateAsync(admin, _options.AdminTempPassword);
        if (!result.Succeeded)
        {
            var details = string.Join("; ", result.Errors.Select(error => $"{error.Code}: {error.Description}"));
            throw new InvalidOperationException($"Failed to seed the System Administrator account: {details}");
        }

        _logger.LogInformation("Seeded System Administrator {Email}.", _options.AdminEmail);
        return AdminSeedOutcome.Created;
    }
}
