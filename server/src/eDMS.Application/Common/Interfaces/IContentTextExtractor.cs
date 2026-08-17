namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Extracts searchable text from a stored PDF or Office document. A null
/// result means the extraction service was unavailable and the document should
/// remain pending for retry; an empty result means extraction completed but no
/// searchable text was produced (including unsupported file types).
/// </summary>
public interface IContentTextExtractor
{
    Task<string?> ExtractAsync(
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);
}
