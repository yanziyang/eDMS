namespace eDMS.Infrastructure.Options;

/// <summary>
/// First-run seeding configuration (TDS §6.5). Both values are required for the seed
/// step to create the initial System Administrator; there is no baked-in default.
/// </summary>
public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    public string AdminEmail { get; set; } = string.Empty;

    public string AdminTempPassword { get; set; } = string.Empty;
}
