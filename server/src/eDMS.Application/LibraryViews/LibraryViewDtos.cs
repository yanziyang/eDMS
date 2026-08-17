using eDMS.Domain;

namespace eDMS.Application.LibraryViews;

public sealed record LibraryViewDto(
    Guid Id,
    Guid LibraryId,
    Guid? OwnerId,
    string Name,
    string FilterConfig,
    string SortConfig,
    string? GroupByColumn,
    bool IsDefault);

public sealed record CreateLibraryViewRequest(
    string Name,
    string FilterConfig,
    string SortConfig,
    string? GroupByColumn,
    bool IsShared = false);

public sealed record UpdateLibraryViewRequest(
    string Name,
    string FilterConfig,
    string SortConfig,
    string? GroupByColumn);

public static class LibraryViewConfigSerializer
{
    private const int MaxConfigLength = 16 * 1024;

    private static readonly System.Text.Json.JsonSerializerOptions SerializerOptions =
        new(System.Text.Json.JsonSerializerDefaults.Web);

    public static string Serialize<T>(T value) =>
        System.Text.Json.JsonSerializer.Serialize(value, SerializerOptions);

    public static T Deserialize<T>(string serialized) =>
        System.Text.Json.JsonSerializer.Deserialize<T>(serialized, SerializerOptions)
        ?? throw new System.Text.Json.JsonException("The saved view configuration was null.");

    public static string NormalizeObject(string? serialized, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(serialized))
        {
            return "{}";
        }

        if (serialized.Length > MaxConfigLength)
        {
            throw new Common.Exceptions.ConflictException(
                $"{propertyName} must be {MaxConfigLength:N0} characters or fewer.");
        }

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(serialized);
            if (document.RootElement.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                throw new Common.Exceptions.ConflictException(
                    $"{propertyName} must contain a JSON object.");
            }

            return document.RootElement.GetRawText();
        }
        catch (System.Text.Json.JsonException)
        {
            throw new Common.Exceptions.ConflictException(
                $"{propertyName} must contain valid JSON.");
        }
    }
}

public interface ILibraryViewService
{
    Task<IReadOnlyList<LibraryViewDto>> ListAsync(
        Guid libraryId,
        CancellationToken cancellationToken = default);

    Task<LibraryViewDto> CreateAsync(
        Guid libraryId,
        CreateLibraryViewRequest request,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(
        Guid libraryId,
        Guid viewId,
        UpdateLibraryViewRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken = default);

    Task SetDefaultAsync(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken = default);
}
