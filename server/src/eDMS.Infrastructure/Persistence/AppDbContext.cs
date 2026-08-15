using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Persistence;

/// <summary>
/// EF Core database context. Entity <see cref="DbSet{TEntity}"/> properties are
/// added as domain entities land in later milestones.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}
