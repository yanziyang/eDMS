using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Library : SoftDeletableEntity
{
    public Guid SiteId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool EnableVersioning { get; set; } = true;

    public bool EnableMinorVersions { get; set; }

    public bool RequireCheckout { get; set; }
}
