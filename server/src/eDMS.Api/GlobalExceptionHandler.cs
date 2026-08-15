using eDMS.Application.Common.Exceptions;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace eDMS.Api;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problem = exception switch
        {
            ValidationException validation => Validation(validation),
            NotFoundException => Problem(404, "urn:edms:not-found", "Not Found", exception.Message),
            ForbiddenException => Problem(403, "urn:edms:forbidden", "Forbidden", exception.Message),
            ConflictException => Problem(409, "urn:edms:conflict", "Conflict", exception.Message),
            _ => Problem(500, "urn:edms:internal-error", "An error occurred.", "An unexpected error occurred."),
        };

        httpContext.Response.StatusCode = problem.Status ?? 500;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }

    private static ProblemDetails Problem(int status, string type, string title, string detail) =>
        new()
        {
            Status = status,
            Type = type,
            Title = title,
            Detail = detail,
        };

    private static ProblemDetails Validation(ValidationException exception) =>
        new()
        {
            Status = 400,
            Type = "urn:edms:validation-error",
            Title = "One or more validation errors occurred.",
            Extensions =
            {
                ["errors"] = exception.Errors
                    .GroupBy(error => error.PropertyName, error => error.ErrorMessage)
                    .ToDictionary(group => group.Key, group => group.ToArray()),
            },
        };
}
