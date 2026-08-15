using eDMS.Domain.Common;

namespace eDMS.Domain;

public sealed class DocumentVersion : AuditableEntity
{
    public Guid DocumentId { get; set; }

    public int VersionMajor { get; set; }

    public int VersionMinor { get; set; }

    public string StorageKey { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public string Checksum { get; set; } = string.Empty;

    public string? Comment { get; set; }

    public bool IsMajor { get; set; }
}
