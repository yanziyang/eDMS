using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Sites.Commands.CreateSite;

public sealed class CreateSiteHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPermissionCacheInvalidator cacheInvalidator) : IRequestHandler<CreateSiteCommand, Guid>
{
    public async Task<Guid> Handle(CreateSiteCommand command, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not { } userId)
        {
            throw new Common.Exceptions.ForbiddenException();
        }

        var slugTaken = await db.Sites.AnyAsync(site => site.UrlSlug == command.UrlSlug, cancellationToken);
        if (slugTaken)
        {
            throw new Common.Exceptions.ConflictException("A site with this URL slug already exists.");
        }

        var site = new Site
        {
            Name = command.Name,
            Description = command.Description,
            UrlSlug = command.UrlSlug,
        };
        site.SetCreator(userId);

        var library = new Library { SiteId = site.Id, Name = "Documents" };
        library.SetCreator(userId);

        var owners = new Group { Name = $"{site.Name} Owners", IsSystem = true, SiteId = site.Id };
        var members = new Group { Name = $"{site.Name} Members", IsSystem = true, SiteId = site.Id };
        var visitors = new Group { Name = $"{site.Name} Visitors", IsSystem = true, SiteId = site.Id };
        owners.SetCreator(userId);
        members.SetCreator(userId);
        visitors.SetCreator(userId);

        db.Sites.Add(site);
        db.Libraries.Add(library);
        db.Groups.AddRange(owners, members, visitors);
        db.SitePermissions.AddRange(
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = owners.Id, Role = SiteRole.Owner },
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = members.Id, Role = SiteRole.Member },
            new SitePermission { SiteId = site.Id, PrincipalType = PrincipalType.Group, PrincipalId = visitors.Id, Role = SiteRole.Visitor });
        db.GroupMembers.Add(new GroupMember { GroupId = owners.Id, UserId = userId });

        await db.SaveChangesAsync(cancellationToken);
        cacheInvalidator.Invalidate();

        return site.Id;
    }
}
