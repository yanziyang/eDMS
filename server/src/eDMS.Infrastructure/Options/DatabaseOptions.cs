namespace eDMS.Infrastructure.Options;

/// <summary>
/// Database providers supported behind the <c>Database:Provider</c> configuration key
/// (ADR-8). The provider is resolved once at startup; EF Core migrations for each live
/// in their own assembly (<c>eDMS.Infrastructure.Migrations.*</c>) because EF applies
/// every migration in a single assembly to every database.
/// </summary>
public enum DatabaseProvider
{
    Postgres,
    SqlServer,
    MySql,
    Sqlite,
}

public static class DatabaseProviderParser
{
    /// <summary>
    /// Parses the <c>Database:Provider</c> configuration value. Empty values default to
    /// <see cref="DatabaseProvider.Postgres"/> (the production database); the local
    /// development default of SQLite is applied by the API host, which passes an
    /// explicit value here.
    /// </summary>
    public static DatabaseProvider Parse(string? value) =>
        (value ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "" or "postgres" or "postgresql" or "npgsql" => DatabaseProvider.Postgres,
            "sqlserver" or "sql server" or "mssql" => DatabaseProvider.SqlServer,
            "mysql" or "mariadb" or "maria" => DatabaseProvider.MySql,
            "sqlite" => DatabaseProvider.Sqlite,
            _ => throw new InvalidOperationException(
                $"Unknown Database:Provider '{value}'. Supported values: Postgres, SqlServer, MySql, Sqlite."),
        };
}
