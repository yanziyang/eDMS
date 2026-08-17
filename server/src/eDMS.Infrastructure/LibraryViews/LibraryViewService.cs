using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Application.LibraryViews;
using eDMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.LibraryViews;

public sealed class LibraryViewService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionResolver permissions) : ILibraryViewService
{
    public async Task<IReadOnlyList<LibraryViewDto>> ListAsync(
        Guid libraryId,
        CancellationToken cancellationToken = default)
    {
        var userId = await RequireLibraryPermissionAsync(
            libraryId,
            PermissionLevel.Read,
            cancellationToken);

        var views = await db.LibraryViews.AsNoTracking()
            .Where(view => view.LibraryId == libraryId
                && (view.OwnerId == null || view.OwnerId == userId))
            .OrderBy(view => view.OwnerId.HasValue)
            .ThenBy(view => view.Name)
            .ToListAsync(cancellationToken);

        return views.Select(ToDto).ToList();
    }

    public async Task<LibraryViewDto> CreateAsync(
        Guid libraryId,
        CreateLibraryViewRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await EnsureLibraryExistsAsync(libraryId, cancellationToken);
        await permissions.RequireAsync(
            userId,
            ObjectType.Library,
            libraryId,
            request.IsShared ? PermissionLevel.FullControl : PermissionLevel.Read,
            cancellationToken);

        var name = NormalizeName(request.Name);
        var filterConfig = LibraryViewConfigSerializer.NormalizeObject(
            request.FilterConfig,
            nameof(request.FilterConfig));
        var sortConfig = LibraryViewConfigSerializer.NormalizeObject(
            request.SortConfig,
            nameof(request.SortConfig));
        var groupByColumn = NormalizeGroupByColumn(request.GroupByColumn);
        Guid? ownerId = request.IsShared ? null : userId;

        var duplicate = await db.LibraryViews.AnyAsync(
            view => view.LibraryId == libraryId
                && view.OwnerId == ownerId
                && view.Name == name,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A view with this name already exists for this library.");
        }

        var view = new LibraryView
        {
            LibraryId = libraryId,
            OwnerId = ownerId,
            Name = name,
            FilterConfig = filterConfig,
            SortConfig = sortConfig,
            GroupByColumn = groupByColumn,
        };
        db.LibraryViews.Add(view);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(view);
    }

    public async Task UpdateAsync(
        Guid libraryId,
        Guid viewId,
        UpdateLibraryViewRequest request,
        CancellationToken cancellationToken = default)
    {
        var view = await LoadOwnedOrSharedViewAsync(libraryId, viewId, cancellationToken);
        await RequireViewPermissionAsync(view, cancellationToken);

        var name = NormalizeName(request.Name);
        var duplicate = await db.LibraryViews.AnyAsync(
            item => item.Id != viewId
                && item.LibraryId == libraryId
                && item.OwnerId == view.OwnerId
                && item.Name == name,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A view with this name already exists for this library.");
        }

        view.Name = name;
        view.FilterConfig = LibraryViewConfigSerializer.NormalizeObject(
            request.FilterConfig,
            nameof(request.FilterConfig));
        view.SortConfig = LibraryViewConfigSerializer.NormalizeObject(
            request.SortConfig,
            nameof(request.SortConfig));
        view.GroupByColumn = NormalizeGroupByColumn(request.GroupByColumn);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken = default)
    {
        var view = await LoadOwnedOrSharedViewAsync(libraryId, viewId, cancellationToken);
        await RequireViewPermissionAsync(view, cancellationToken);
        db.LibraryViews.Remove(view);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task SetDefaultAsync(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await EnsureLibraryExistsAsync(libraryId, cancellationToken);
        await permissions.RequireAsync(
            userId,
            ObjectType.Library,
            libraryId,
            PermissionLevel.FullControl,
            cancellationToken);

        var view = await db.LibraryViews.SingleOrDefaultAsync(
            item => item.Id == viewId && item.LibraryId == libraryId,
            cancellationToken)
            ?? throw new NotFoundException(nameof(LibraryView), viewId);
        if (view.OwnerId is not null)
        {
            throw new ConflictException("Only a shared view can be the library default.");
        }

        var defaults = await db.LibraryViews
            .Where(item => item.LibraryId == libraryId && item.IsDefault)
            .ToListAsync(cancellationToken);
        foreach (var existing in defaults)
        {
            existing.IsDefault = false;
        }

        view.IsDefault = true;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<LibraryView> LoadOwnedOrSharedViewAsync(
        Guid libraryId,
        Guid viewId,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await EnsureLibraryExistsAsync(libraryId, cancellationToken);

        var view = await db.LibraryViews.SingleOrDefaultAsync(
            item => item.Id == viewId && item.LibraryId == libraryId,
            cancellationToken)
            ?? throw new NotFoundException(nameof(LibraryView), viewId);

        // Do not reveal another user's personal view through mutation endpoints.
        if (view.OwnerId is not null && view.OwnerId != userId)
        {
            throw new NotFoundException(nameof(LibraryView), viewId);
        }

        return view;
    }

    private async Task RequireViewPermissionAsync(
        LibraryView view,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await permissions.RequireAsync(
            userId,
            ObjectType.Library,
            view.LibraryId,
            view.OwnerId is null ? PermissionLevel.FullControl : PermissionLevel.Read,
            cancellationToken);
    }

    private async Task<Guid> RequireLibraryPermissionAsync(
        Guid libraryId,
        PermissionLevel required,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        await EnsureLibraryExistsAsync(libraryId, cancellationToken);
        await permissions.RequireAsync(
            userId,
            ObjectType.Library,
            libraryId,
            required,
            cancellationToken);
        return userId;
    }

    private async Task EnsureLibraryExistsAsync(
        Guid libraryId,
        CancellationToken cancellationToken) =>
        _ = await db.Libraries.SingleOrDefaultAsync(
            library => library.Id == libraryId,
            cancellationToken)
            ?? throw new NotFoundException(nameof(Library), libraryId);

    private static string NormalizeName(string? name)
    {
        var normalized = name?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            throw new ConflictException("View name is required.");
        }

        if (normalized.Length > 256)
        {
            throw new ConflictException("View name must be 256 characters or fewer.");
        }

        return normalized;
    }

    private static string? NormalizeGroupByColumn(string? groupByColumn)
    {
        var normalized = groupByColumn?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return null;
        }

        if (normalized.Length > 128)
        {
            throw new ConflictException("GroupByColumn must be 128 characters or fewer.");
        }

        return normalized;
    }

    private static LibraryViewDto ToDto(LibraryView view) => new(
        view.Id,
        view.LibraryId,
        view.OwnerId,
        view.Name,
        view.FilterConfig,
        view.SortConfig,
        view.GroupByColumn,
        view.IsDefault);
}
