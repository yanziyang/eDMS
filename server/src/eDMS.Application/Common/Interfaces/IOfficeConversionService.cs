namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Converts Office documents to PDF for in-browser preview (FR-DOC-10). Returns
/// null when conversion is unavailable (converter unreachable, unsupported input,
/// or failure) so callers can fall back to serving the original bytes.
/// </summary>
public interface IOfficeConversionService
{
    Task<Stream?> ConvertToPdfAsync(
        string fileName,
        Stream content,
        CancellationToken cancellationToken = default);
}
