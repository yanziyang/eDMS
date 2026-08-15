using System.Threading;
using eDMS.Application.Common.Interfaces;

namespace eDMS.Infrastructure.Security;

public sealed class PermissionCacheInvalidator : IPermissionCacheInvalidator
{
    private long _generation;

    public long Generation => Interlocked.Read(ref _generation);

    public void Invalidate() => Interlocked.Increment(ref _generation);
}
