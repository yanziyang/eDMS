using System.Reflection;
using NetArchTest.Rules;
using Xunit;

namespace eDMS.Application.UnitTests;

/// <summary>
/// Enforces the load-bearing project dependency direction described in TDS §2.3:
/// Domain references nothing outward, and Application never reaches Infrastructure or Api.
/// </summary>
public sealed class ArchitectureTests
{
    [Fact]
    public void Domain_has_no_dependencies_on_outer_layers()
    {
        var domain = typeof(eDMS.Domain.DomainRoot).Assembly;

        AssertNoDependency(domain, "eDMS.Application");
        AssertNoDependency(domain, "eDMS.Infrastructure");
        AssertNoDependency(domain, "eDMS.Api");
    }

    [Fact]
    public void Application_has_no_dependencies_on_infrastructure_or_api()
    {
        var application = typeof(eDMS.Application.DependencyInjection).Assembly;

        AssertNoDependency(application, "eDMS.Infrastructure");
        AssertNoDependency(application, "eDMS.Api");
    }

    private static void AssertNoDependency(Assembly assembly, string dependencyNamespace)
    {
        var result = Types.InAssembly(assembly)
            .Should()
            .NotHaveDependencyOn(dependencyNamespace)
            .GetResult();

        var offenders = result.FailingTypeNames is null
            ? "none"
            : string.Join(", ", result.FailingTypeNames);

        Assert.True(
            result.IsSuccessful,
            $"{assembly.GetName().Name} should not depend on {dependencyNamespace}. Offenders: {offenders}");
    }
}
