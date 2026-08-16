using FluentValidation;
using MediatR;

namespace eDMS.Application.Sites.Queries.GetSite;

public sealed class GetSiteValidator : AbstractValidator<GetSiteQuery>
{
    public GetSiteValidator()
    {
        RuleFor(query => query.SiteId).NotEmpty();
    }
}
