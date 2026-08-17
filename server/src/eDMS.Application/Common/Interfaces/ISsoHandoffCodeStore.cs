namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Persists short-lived, single-use SSO handoff credentials. Implementations must
/// store only a hash of the opaque code and consume it atomically.
/// </summary>
public interface ISsoHandoffCodeStore
{
    Task<string> IssueAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<Guid?> ConsumeAsync(string code, CancellationToken cancellationToken = default);
}
