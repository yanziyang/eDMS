using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class Folder : SoftDeletableEntity
{
    public Guid LibraryId { get; set; }

    public Guid? ParentFolderId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;

    public Guid? ModifiedBy { get; set; }

    public DateTimeOffset? ModifiedAt { get; set; }
}
