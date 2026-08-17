using System.Data;
using System.Security.Cryptography;
using System.Text;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace eDMS.Infrastructure.Auth;

public sealed class SsoHandoffCodeStore(AppDbContext db, TimeProvider timeProvider)
    : ISsoHandoffCodeStore
{
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromSeconds(60);

    public async Task<string> IssueAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var code = CreateCode();
        var now = timeProvider.GetUtcNow();

        db.SsoHandoffCodes.Add(new SsoHandoffCode
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CodeHash = HashCode(code),
            ExpiresAt = now.Add(CodeLifetime),
        });

        await db.SaveChangesAsync(cancellationToken);
        return code;
    }

    public async Task<Guid?> ConsumeAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var hash = HashCode(code);
        var providerName = db.Database.ProviderName ?? string.Empty;

        // EF Core's in-memory provider has no database command surface. This path
        // exists for fast unit tests; every relational provider uses the atomic SQL
        // path below.
        if (providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            return await ConsumeInMemoryAsync(hash, cancellationToken);
        }

        if (providerName.Contains("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            return await ConsumeSqliteAsync(hash, cancellationToken);
        }

        return providerName.Contains("MySql", StringComparison.OrdinalIgnoreCase)
            ? await ConsumeMySqlAsync(hash, cancellationToken)
            : await ConsumeWithReturningAsync(hash, providerName, cancellationToken);
    }

    private async Task<Guid?> ConsumeInMemoryAsync(
        string hash,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var handoff = await db.SsoHandoffCodes
            .SingleOrDefaultAsync(item => item.CodeHash == hash, cancellationToken);

        if (handoff is null || handoff.ConsumedAt is not null || handoff.ExpiresAt <= now)
        {
            return null;
        }

        handoff.ConsumedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        return handoff.UserId;
    }

    private async Task<Guid?> ConsumeSqliteAsync(
        string hash,
        CancellationToken cancellationToken)
    {
        // SQLite stores DateTimeOffset through EF's binary converter, so use
        // ExecuteUpdate rather than comparing the converted column to SQLite's
        // textual CURRENT_TIMESTAMP. The conditional update remains the
        // single-consumer gate; the preliminary read only supplies the user id.
        var now = timeProvider.GetUtcNow();
        var handoff = await db.SsoHandoffCodes
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.CodeHash == hash
                    && item.ConsumedAt == null
                    && item.ExpiresAt > now,
                cancellationToken);

        if (handoff is null)
        {
            return null;
        }

        var affected = await db.SsoHandoffCodes
            .Where(item => item.CodeHash == hash
                && item.ConsumedAt == null
                && item.ExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(item => item.ConsumedAt, now),
                cancellationToken);

        return affected == 1 ? handoff.UserId : null;
    }

    private async Task<Guid?> ConsumeWithReturningAsync(
        string hash,
        string providerName,
        CancellationToken cancellationToken)
    {
        var sql = providerName.Contains("SqlServer", StringComparison.OrdinalIgnoreCase)
            ? """
              UPDATE sso_handoff_codes
              SET consumed_at = SYSUTCDATETIME()
              OUTPUT INSERTED.user_id
              WHERE code_hash = @hash
                AND consumed_at IS NULL
                AND expires_at > SYSUTCDATETIME();
              """
            : """
              UPDATE sso_handoff_codes
              SET consumed_at = CURRENT_TIMESTAMP
              WHERE code_hash = @hash
                AND consumed_at IS NULL
                AND expires_at > CURRENT_TIMESTAMP
              RETURNING user_id;
              """;

        return await ExecuteReturningUserIdAsync(sql, hash, cancellationToken);
    }

    private async Task<Guid?> ConsumeMySqlAsync(
        string hash,
        CancellationToken cancellationToken)
    {
        // MySQL does not implement UPDATE ... RETURNING. A row lock inside one
        // transaction preserves the same single-consumer guarantee for that
        // provider while keeping the conditional update itself atomic.
        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var select = db.Database.GetDbConnection().CreateCommand();
        select.Transaction = transaction.GetDbTransaction();
        select.CommandText = """
            SELECT user_id
            FROM sso_handoff_codes
            WHERE code_hash = @hash
              AND consumed_at IS NULL
              AND expires_at > UTC_TIMESTAMP(6)
            FOR UPDATE;
            """;
        AddHashParameter(select, hash);

        await using (select)
        await using (var reader = await select.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken))
            {
                await transaction.CommitAsync(cancellationToken);
                return null;
            }

            var userId = ReadGuid(reader.GetValue(0));
            await reader.DisposeAsync();

            var update = db.Database.GetDbConnection().CreateCommand();
            update.Transaction = transaction.GetDbTransaction();
            update.CommandText = """
                UPDATE sso_handoff_codes
                SET consumed_at = UTC_TIMESTAMP(6)
                WHERE code_hash = @hash
                  AND consumed_at IS NULL
                  AND expires_at > UTC_TIMESTAMP(6);
                """;
            AddHashParameter(update, hash);
            await using (update)
            {
                if (await update.ExecuteNonQueryAsync(cancellationToken) != 1)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return null;
                }
            }

            await transaction.CommitAsync(cancellationToken);
            return userId;
        }
    }

    private async Task<Guid?> ExecuteReturningUserIdAsync(
        string sql,
        string hash,
        CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        var closeConnection = connection.State != ConnectionState.Open;
        if (closeConnection)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            if (db.Database.CurrentTransaction is not null)
            {
                command.Transaction = db.Database.CurrentTransaction.GetDbTransaction();
            }

            AddHashParameter(command, hash);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken)
                ? ReadGuid(reader.GetValue(0))
                : null;
        }
        finally
        {
            if (closeConnection)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static void AddHashParameter(System.Data.Common.DbCommand command, string hash)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@hash";
        parameter.Value = hash;
        command.Parameters.Add(parameter);
    }

    private static Guid ReadGuid(object value) => value switch
    {
        Guid guid => guid,
        string text => Guid.Parse(text),
        byte[] bytes => new Guid(bytes),
        _ => Guid.Parse(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture)!),
    };

    private static string CreateCode() => Convert.ToBase64String(
            RandomNumberGenerator.GetBytes(32))
        .Replace('+', '-')
        .Replace('/', '_')
        .TrimEnd('=');

    private static string HashCode(string code) => Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(code)))
        .ToLowerInvariant();
}
