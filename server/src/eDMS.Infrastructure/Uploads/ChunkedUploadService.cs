using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.Documents;
using eDMS.Application.Uploads;
using eDMS.Domain;
using eDMS.Infrastructure.Documents;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Uploads;

/// <summary>
/// Session-based resumable upload (FR-DOC-12, ADR-11): the client starts a session,
/// appends ordered chunks (each must continue exactly where the last left off), then
/// completes, which hands the assembled stream to <see cref="DocumentService"/>.
/// Chunk data lives in a temp file per session; sessions expire and are swept by
/// <see cref="eDMS.Infrastructure.Background.OrphanedUploadSweepService"/>.
/// </summary>
public sealed class ChunkedUploadService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions,
    IDocumentService documents) : IChunkedUploadService
{
    public const int ChunkSize = 8 * 1024 * 1024;

    public async Task<UploadSessionDto> StartAsync(
        StartUploadRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, request.LibraryId, PermissionLevel.Contribute, cancellationToken);

        var library = await db.Libraries.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == request.LibraryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Library), request.LibraryId);

        if (request.TotalBytes <= 0)
        {
            throw new ConflictException("TotalBytes must be greater than zero.");
        }

        var session = new UploadSession
        {
            LibraryId = request.LibraryId,
            FolderId = request.FolderId,
            FileName = request.FileName,
            TotalBytes = request.TotalBytes,
            UploadedBytes = 0,
            MetadataJson = request.Metadata is { Count: > 0 }
                ? System.Text.Json.JsonSerializer.Serialize(request.Metadata)
                : null,
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(24),
        };
        session.SetCreator(userId);
        db.UploadSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return ToDto(session);
    }

    public async Task<UploadSessionDto> GetStatusAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default)
    {
        var session = await LoadAuthorizedAsync(sessionId, PermissionLevel.Read, cancellationToken);
        return ToDto(session);
    }

    public async Task<UploadSessionDto> AppendChunkAsync(
        Guid sessionId,
        long offset,
        Stream chunk,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var session = await LoadAuthorizedAsync(sessionId, PermissionLevel.Contribute, cancellationToken);

        if (offset != session.UploadedBytes)
        {
            throw new ConflictException(
                $"Chunk offset {offset} does not match the expected continuation point {session.UploadedBytes}.");
        }

        var path = ChunkPath(sessionId);
        await using (var target = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await chunk.CopyToAsync(target, cancellationToken);
        }

        var appended = new FileInfo(path).Length;
        session.UploadedBytes = appended;
        if (session.UploadedBytes > session.TotalBytes)
        {
            throw new ConflictException("Upload exceeds the declared total size.");
        }

        await db.SaveChangesAsync(cancellationToken);
        return ToDto(session);
    }

    public async Task<eDMS.Application.Documents.UploadResult> CompleteAsync(
        Guid sessionId,
        IReadOnlyList<ColumnValueInput>? metadata,
        CancellationToken cancellationToken = default)
    {
        var session = await LoadAuthorizedAsync(sessionId, PermissionLevel.Contribute, cancellationToken);

        var path = ChunkPath(sessionId);
        if (!File.Exists(path))
        {
            throw new ConflictException("No chunks have been uploaded for this session.");
        }

        UploadResult result;
        await using (var stream = File.OpenRead(path))
        {
            result = await documents.UploadAsync(
                session.LibraryId,
                session.FolderId,
                session.FileName,
                stream,
                metadata ?? ParseMetadata(session.MetadataJson),
                cancellationToken);
        }

        File.Delete(path);
        db.UploadSessions.Remove(session);
        await db.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task AbortAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var session = await LoadAuthorizedAsync(sessionId, PermissionLevel.Contribute, cancellationToken);

        File.Delete(ChunkPath(sessionId));
        db.UploadSessions.Remove(session);
        await db.SaveChangesAsync(cancellationToken);
    }

    internal static string ChunkPath(Guid sessionId) =>
        Path.Combine(Path.GetTempPath(), $"edms-chunk-{sessionId:N}.part");

    private async Task<UploadSession> LoadAuthorizedAsync(
        Guid sessionId,
        PermissionLevel required,
        CancellationToken cancellationToken)
    {
        var session = await db.UploadSessions
            .SingleOrDefaultAsync(item => item.Id == sessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(UploadSession), sessionId);

        if (session.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            throw new ConflictException("This upload session has expired. Start a new upload.");
        }

        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(userId, ObjectType.Library, session.LibraryId, required, cancellationToken);
        return session;
    }

    private static IReadOnlyList<ColumnValueInput>? ParseMetadata(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<ColumnValueInput>>(
                json,
                System.Text.Json.JsonSerializerOptions.Web);
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static UploadSessionDto ToDto(UploadSession session) =>
        new(
            session.Id,
            session.FileName,
            session.TotalBytes,
            session.UploadedBytes,
            ChunkSize,
            session.ExpiresAt);
}
