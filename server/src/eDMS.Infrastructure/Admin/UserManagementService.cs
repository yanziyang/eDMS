using eDMS.Application.Admin;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Infrastructure.Admin;

public sealed class UserManagementService(
    UserManager<ApplicationUser> userManager,
    ITokenService tokenService) : IUserManagementService
{
    public async Task<IReadOnlyList<UserDto>> ListAsync(string? search, CancellationToken cancellationToken = default)
    {
        var query = userManager.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(user => user.Email!.Contains(search)
                || user.DisplayName.Contains(search));
        }

        var users = await query.OrderBy(user => user.Email).ToListAsync(cancellationToken);
        return users.Select(user => new UserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.DisplayName,
            user.IsActive,
            user.IsSystemAdmin,
            user.LocalLoginDisabled,
            user.SsoExempt,
            user.CreatedAt,
            user.LastLoginAt)).ToList();
    }

    public async Task<Guid> CreateAsync(
        string email,
        string displayName,
        string tempPassword,
        bool isSystemAdmin,
        CancellationToken cancellationToken = default)
    {
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = displayName,
            EmailConfirmed = true,
            IsActive = true,
            IsSystemAdmin = isSystemAdmin,
            MustChangePassword = true,
            AuthProvider = AuthProvider.Local,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(user, tempPassword);
        if (!result.Succeeded)
        {
            var message = string.Join("; ", result.Errors.Select(error => error.Description));
            throw new ConflictException(message);
        }

        return user.Id;
    }

    public async Task UpdateAsync(
        Guid userId,
        string displayName,
        bool isSystemAdmin,
        bool localLoginDisabled,
        bool ssoExempt,
        CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException(nameof(ApplicationUser), userId);

        user.DisplayName = displayName;
        user.IsSystemAdmin = isSystemAdmin;
        user.LocalLoginDisabled = localLoginDisabled;
        user.SsoExempt = ssoExempt;
        await userManager.UpdateAsync(user);
    }

    public async Task SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException(nameof(ApplicationUser), userId);

        user.IsActive = isActive;
        await userManager.UpdateAsync(user);

        if (!isActive)
        {
            await tokenService.RevokeAllForUserAsync(userId, cancellationToken);
        }
    }
}
