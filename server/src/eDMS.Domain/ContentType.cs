using eDMS.Domain.Common;

namespace eDMS.Domain;

/// <summary>
/// The data type of a <see cref="ColumnDefinition"/> (FS §8.2). Values are stored as
/// text in <see cref="DocumentColumnValue"/>; typed parsing/formatting is a client
/// concern so storage stays provider-portable (ADR-9).
/// </summary>
public enum ColumnDataType
{
    Text = 0,
    Number = 1,
    Date = 2,
    Choice = 3,
    Boolean = 4,
    User = 5,
    Lookup = 6,
}

/// <summary>
/// A named, reusable metadata template (FR-META-03). LibraryId null = org-wide
/// reusable type; otherwise the type belongs to a single library.
/// </summary>
public sealed class ContentType : AuditableEntity
{
    public Guid? LibraryId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

/// <summary>
/// One column of a <see cref="ContentType"/> (FS §8.2).
/// </summary>
public sealed class ColumnDefinition : AuditableEntity
{
    public Guid ContentTypeId { get; set; }

    public string Name { get; set; } = string.Empty;

    public ColumnDataType DataType { get; set; }

    public bool IsRequired { get; set; }

    /// <summary>
    /// JSON array text for <see cref="ColumnDataType.Choice"/> columns. Plain text on
    /// every provider (ADR-9) rather than Postgres-only jsonb.
    /// </summary>
    public string? ChoiceOptions { get; set; }

    public string? DefaultValue { get; set; }
}

/// <summary>
/// A document's value for one column of its content type. Composite key
/// (DocumentId, ColumnDefinitionId); stored as text on every provider (ADR-9).
/// </summary>
public sealed class DocumentColumnValue
{
    public Guid DocumentId { get; set; }

    public Guid ColumnDefinitionId { get; set; }

    public string Value { get; set; } = string.Empty;
}
