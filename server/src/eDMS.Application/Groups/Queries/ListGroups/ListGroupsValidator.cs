using FluentValidation;
using MediatR;

namespace eDMS.Application.Groups.Queries.ListGroups;

public sealed class ListGroupsValidator : AbstractValidator<ListGroupsQuery>
{
    // SiteId is optional (lists global groups when omitted); the validator exists
    // to satisfy the every-request-has-a-validator rule (M11.1).
}
