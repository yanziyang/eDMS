using FluentValidation;
using MediatR;

namespace eDMS.Application.Libraries.Queries.ListLibraries;

public sealed class ListLibrariesValidator : AbstractValidator<ListLibrariesQuery>
{
    public ListLibrariesValidator()
    {
        RuleFor(query => query.SiteId).NotEmpty();
    }
}
