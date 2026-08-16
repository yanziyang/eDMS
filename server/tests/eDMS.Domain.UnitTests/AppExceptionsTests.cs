using eDMS.Application.Common.Exceptions;
using Xunit;

namespace eDMS.Domain.UnitTests;

public sealed class AppExceptionsTests
{
    [Fact]
    public void NotFound_exception_formats_message_with_string_key()
    {
        var exception = new NotFoundException("Document", "invoice-1");

        Assert.Equal("'Document' (invoice-1) was not found.", exception.Message);
    }

    [Fact]
    public void NotFound_exception_formats_message_with_guid_key()
    {
        var key = Guid.NewGuid();
        var exception = new NotFoundException("Site", key);

        Assert.Equal($"'Site' ({key}) was not found.", exception.Message);
    }

    [Fact]
    public void Forbidden_exception_uses_default_message_when_none_is_given()
    {
        var exception = new ForbiddenException();

        Assert.Equal("You do not have permission to perform this action.", exception.Message);
    }

    [Fact]
    public void Forbidden_exception_accepts_a_custom_message()
    {
        var exception = new ForbiddenException("The site is archived and read-only.");

        Assert.Equal("The site is archived and read-only.", exception.Message);
    }

    [Fact]
    public void Conflict_exception_uses_the_given_message()
    {
        var exception = new ConflictException("The document is already checked out.");

        Assert.Equal("The document is already checked out.", exception.Message);
    }

    [Fact]
    public void All_app_exceptions_are_standard_exceptions()
    {
        Assert.IsAssignableFrom<Exception>(new NotFoundException("Doc", 1));
        Assert.IsAssignableFrom<Exception>(new ForbiddenException());
        Assert.IsAssignableFrom<Exception>(new ConflictException("conflict"));
    }
}
