using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure.Storage;

public sealed class LocalDiskFileStorageProvider(IOptions<StorageOptions> options) : IFileStorageProvider
{
    private readonly string _root = Path.GetFullPath(options.Value.RootPath);

    public async Task<string> SaveAsync(
        Stream content,
        string suggestedKey,
        CancellationToken cancellationToken = default)
    {
        var fullPath = Resolve(suggestedKey);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var target = File.Create(fullPath);
        await content.CopyToAsync(target, cancellationToken);
        return suggestedKey;
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var fullPath = Resolve(storageKey);
        return Task.FromResult<Stream>(File.OpenRead(fullPath));
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var fullPath = Resolve(storageKey);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    private string Resolve(string storageKey)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_root, storageKey));
        if (!fullPath.StartsWith(_root, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Storage key escapes the storage root.");
        }

        return fullPath;
    }
}
