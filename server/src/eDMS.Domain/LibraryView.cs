namespace eDMS.Domain;

/// <summary>
/// A saved combination of library display settings. A null owner makes the view
/// shared with everyone who can read the library; a non-null owner makes it
/// personal to that user (FR-UI-10).
/// </summary>
public sealed class LibraryView
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid LibraryId { get; set; }

    public Guid? OwnerId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string FilterConfig { get; set; } = "{}";

    public string SortConfig { get; set; } = "{}";

    public string? GroupByColumn { get; set; }

    public bool IsDefault { get; set; }
}
