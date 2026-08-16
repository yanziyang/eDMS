using eDMS.Infrastructure.Options;

namespace eDMS.IntegrationTests;

public sealed class DatabaseProviderParserTests
{
    [Theory]
    [InlineData(null, DatabaseProvider.Postgres)]
    [InlineData("", DatabaseProvider.Postgres)]
    [InlineData("Postgres", DatabaseProvider.Postgres)]
    [InlineData("postgresql", DatabaseProvider.Postgres)]
    [InlineData("Npgsql", DatabaseProvider.Postgres)]
    [InlineData("SqlServer", DatabaseProvider.SqlServer)]
    [InlineData("sql server", DatabaseProvider.SqlServer)]
    [InlineData("mssql", DatabaseProvider.SqlServer)]
    [InlineData("MySql", DatabaseProvider.MySql)]
    [InlineData("MariaDB", DatabaseProvider.MySql)]
    [InlineData("Sqlite", DatabaseProvider.Sqlite)]
    [InlineData(" SQLite ", DatabaseProvider.Sqlite)]
    public void Parse_returns_expected_provider(string? value, DatabaseProvider expected) =>
        Assert.Equal(expected, DatabaseProviderParser.Parse(value));

    [Fact]
    public void Parse_throws_for_unknown_provider()
    {
        var exception = Assert.Throws<InvalidOperationException>(() => DatabaseProviderParser.Parse("Oracle"));
        Assert.Contains("Oracle", exception.Message);
    }
}
