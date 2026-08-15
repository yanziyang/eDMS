namespace eDMS.Application.Common.Interfaces;

/// <summary>
/// Bumps a generation counter on every permission-affecting mutation so cached
/// effective-permission lookups are never served stale (TDS §5.3).
/// </summary>
public interface IPermissionCacheInvalidator
{
    long Generation { get; }

    void Invalidate();
}
