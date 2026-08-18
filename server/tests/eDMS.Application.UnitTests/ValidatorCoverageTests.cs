using System.Reflection;
using eDMS.Application;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace eDMS.Application.UnitTests;

/// <summary>
/// Every MediatR command/query must have a registered FluentValidation validator
/// (M11.1, M19.4, M23.2, M31.2, AGENTS.md §7 rule 7). The check is DI-based so a
/// validator that exists but was never registered also fails the audit. The
/// assembly-wide discovery means any new Phase 3 or Phase 4 command/query is included
/// automatically rather than relying on a hand-maintained allow-list.
/// </summary>
public sealed class ValidatorCoverageTests
{
    private static readonly Assembly ApplicationAssembly = typeof(DependencyInjection).Assembly;

    private static readonly ServiceProvider Provider = new ServiceCollection()
        .AddApplication()
        .BuildServiceProvider();

    public static TheoryData<Type> RequestTypes()
    {
        var data = new TheoryData<Type>();
        var requestTypes = ApplicationAssembly.GetTypes()
            .Where(type => type.IsClass
                && !type.IsAbstract
                && typeof(IBaseRequest).IsAssignableFrom(type)
                && type.Namespace != null
                && type.Namespace.StartsWith("eDMS.Application", StringComparison.Ordinal));

        foreach (var type in requestTypes.OrderBy(type => type.FullName))
        {
            data.Add(type);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(RequestTypes))]
    public void Every_request_has_a_registered_validator(Type requestType)
    {
        var validatorInterface = typeof(IValidator<>).MakeGenericType(requestType);
        var validators = Provider.GetServices(validatorInterface).ToList();

        Assert.NotEmpty(validators);
    }

    [Fact]
    public void Phase4_mediatr_commands_are_present_in_the_validator_inventory()
    {
        var phase4Commands = new[]
        {
            typeof(eDMS.Application.Sites.Commands.UpdateSite.UpdateSiteCommand),
            typeof(eDMS.Application.Documents.Commands.BulkUpdateMetadata.BulkUpdateMetadataCommand),
        };
        var discoveredRequests = ApplicationAssembly.GetTypes()
            .Where(type => type.IsClass
                && !type.IsAbstract
                && typeof(IBaseRequest).IsAssignableFrom(type)
                && type.Namespace != null
                && type.Namespace.StartsWith("eDMS.Application", StringComparison.Ordinal))
            .ToHashSet();

        foreach (var commandType in phase4Commands)
        {
            Assert.Contains(commandType, discoveredRequests);
            var validatorInterface = typeof(IValidator<>).MakeGenericType(commandType);
            Assert.NotEmpty(Provider.GetServices(validatorInterface));
        }
    }
}
