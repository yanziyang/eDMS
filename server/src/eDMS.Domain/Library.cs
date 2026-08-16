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

    /// <summary>
    /// Optional cap on retained minor versions (FR-VER-09): when set, the oldest
    /// minor versions beyond the cap are trimmed on check-in. Majors are never
    /// auto-trimmed. Null = unlimited.
    /// </summary>
    public int? MinorVersionsRetained { get; set; }
}
