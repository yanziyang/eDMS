using eDMS.Domain;

namespace eDMS.Application.Admin;

public sealed record ContentTypeDto(
    Guid Id,
    Guid? LibraryId,
    string Name,
    string? Description,
    IReadOnlyList<ColumnDefinitionDto> Columns);

public sealed record ColumnDefinitionDto(
    Guid Id,
    string Name,
    ColumnDataType DataType,
    bool IsRequired,
    string? ChoiceOptions,
    string? DefaultValue);

public sealed record DocumentMetadataDto(
    Guid? ContentTypeId,
    string? ContentTypeName,
    IReadOnlyList<DocumentMetadataColumnDto> Columns);

public sealed record DocumentMetadataColumnDto(
    Guid ColumnDefinitionId,
    string Name,
    ColumnDataType DataType,
    bool IsRequired,
    string? ChoiceOptions,
    string? DefaultValue,
    string? Value);

public sealed record ColumnValueInput(Guid ColumnDefinitionId, string? Value);
