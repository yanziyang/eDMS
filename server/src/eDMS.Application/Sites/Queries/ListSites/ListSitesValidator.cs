using FluentValidation;
using MediatR;

namespace eDMS.Application.Sites.Queries.ListSites;

public sealed class ListSitesValidator : AbstractValidator<ListSitesQuery>
{
    // Parameterless request; the validator exists to satisfy the
    // every-request-has-a-validator rule (M11.1).
}
