using eDMS.Application.Common;
using eDMS.Application.Common.Behaviors;
using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Xunit;

namespace eDMS.Application.UnitTests;

public sealed class AuthorizationBehaviorTests
{
    [Fact]
    public async Task Authorizes_authorizable_request_before_handler()
    {
        var resolver = new RecordingResolver(PermissionLevel.FullControl);
        var behavior = new AuthorizationBehavior<TestRequest, Unit>(resolver, new FixedCurrentUser(Guid.NewGuid()));

        await behavior.Handle(new TestRequest(), () => Task.FromResult(Unit.Value), default);

        Assert.Single(resolver.Calls);
        Assert.Equal(ObjectType.Document, resolver.Calls[0].Type);
        Assert.Equal(PermissionLevel.Contribute, resolver.Calls[0].Required);
    }

    [Fact]
    public async Task Throws_forbidden_when_permission_is_insufficient()
    {
        var resolver = new RecordingResolver(PermissionLevel.NoAccess);
        var behavior = new AuthorizationBehavior<TestRequest, Unit>(resolver, new FixedCurrentUser(Guid.NewGuid()));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            behavior.Handle(new TestRequest(), () => Task.FromResult(Unit.Value), default));
    }

    [Fact]
    public async Task Skips_authorization_for_anonymous_marked_request()
    {
        var resolver = new RecordingResolver(PermissionLevel.NoAccess);
        var behavior = new AuthorizationBehavior<AnonymousRequest, Unit>(resolver, new FixedCurrentUser(null));

        await behavior.Handle(new AnonymousRequest(), () => Task.FromResult(Unit.Value), default);

        Assert.Empty(resolver.Calls);
    }

    [AllowAnonymousCheck]
    private sealed record AnonymousRequest : IRequest<Unit>, IAuthorizableRequest
    {
        public ObjectType ObjectType => ObjectType.Site;

        public Guid ObjectId { get; } = Guid.NewGuid();

        public PermissionLevel RequiredLevel => PermissionLevel.FullControl;
    }

    private sealed record TestRequest : IRequest<Unit>, IAuthorizableRequest
    {
        public ObjectType ObjectType => ObjectType.Document;

        public Guid ObjectId { get; } = Guid.NewGuid();

        public PermissionLevel RequiredLevel => PermissionLevel.Contribute;
    }

    private sealed class FixedCurrentUser(Guid? userId) : ICurrentUser
    {
        public Guid? UserId => userId;

        public bool IsSystemAdmin => false;

        public string? Email => null;

        public string? IpAddress => null;
    }

    private sealed class RecordingResolver(PermissionLevel level) : IPermissionResolver
    {
        public List<(ObjectType Type, Guid Id, PermissionLevel Required)> Calls { get; } = [];

        public Task<PermissionLevel> GetEffectiveLevelAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(level);

        public Task RequireAsync(
            Guid userId,
            ObjectType type,
            Guid objectId,
            PermissionLevel required,
            CancellationToken cancellationToken = default)
        {
            Calls.Add((type, objectId, required));
            if (level > required)
            {
                throw new ForbiddenException();
            }

            return Task.CompletedTask;
        }
    }
}
