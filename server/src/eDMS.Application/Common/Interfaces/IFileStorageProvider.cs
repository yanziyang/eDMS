namespace eDMS.Application.Common.Interfaces;

public interface IFileStorageProvider
{
    Task<string> SaveAsync(Stream content, string suggestedKey, CancellationToken cancellationToken = default);

    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default);

    Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default);
}
