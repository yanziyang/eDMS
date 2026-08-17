using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using eDMS.Infrastructure.Favorites;
using eDMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace eDMS.IntegrationTests;

public sealed class FavoritesServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FakeCurrentUser _currentUser = new(Guid.NewGuid());

    public FavoritesServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        var visible = new Site { Name = "Visible site", UrlSlug = "visible" };
        visible.SetCreator(_currentUser.UserId!.Value);
        var hidden = new Site { Name = "Hidden site", UrlSlug = "hidden" };
        hidden.SetCreator(_currentUser.UserId!.Value);
        _db.Sites.AddRange(visible, hidden);
        _db.FavoriteItems.AddRange(
            new FavoriteItem
            {
                UserId = _currentUser.UserId.Value,
                ObjectType = ObjectType.Site,
                ObjectId = visible.Id,
            },
            new FavoriteItem
            {
                UserId = _currentUser.UserId.Value,
                ObjectType = ObjectType.Site,
                ObjectId = hidden.Id,
            });
        _db.SaveChanges();
        DeniedObjectId = hidden.Id;
    }

    private Guid DeniedObjectId { get; }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task List_filters_favorites_using_effective_permission_before_returning_names()
    {
        var service = new FavoritesService(
            _db,
            _currentUser,
            new SelectiveResolver(DeniedObjectId));

        var result = await service.ListAsync();

        var item = Assert.Single(result);
        Assert.Equal("Visible site", item.Name);
        Assert.DoesNotContain(result, favorite => favorite.Name == "Hidden site");
    }

    private sealed class FakeCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid? UserId => userId;
        public bool IsSystemAdmin => false;
        public string? Email => null;
        public string? IpAddress => null;
        public string? ShareToken => null;
    }

    private sealed class SelectiveResolver(Guid deniedObjectId) : IPermissionResolver
    {
        public Task<PermissionLevel> GetEffectiveLevelAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(objectId == deniedObjectId ? PermissionLevel.NoAccess : PermissionLevel.FullControl);

        public Task RequireAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            PermissionLevel required,
            CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
