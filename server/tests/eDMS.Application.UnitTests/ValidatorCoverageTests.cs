using System.Reflection;
using eDMS.Application;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace eDMS.Application.UnitTests;

/// <summary>
/// Every MediatR command/query must have a registered FluentValidation validator
/// (M11.1, AGENTS.md §7 rule 7). The check is DI-based so a validator that exists
/// but was never registered also fails the audit.
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
}
