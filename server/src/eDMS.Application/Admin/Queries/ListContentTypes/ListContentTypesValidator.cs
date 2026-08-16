using FluentValidation;

namespace eDMS.Application.Admin.Queries.ListContentTypes;

public sealed class ListContentTypesValidator : AbstractValidator<ListContentTypesQuery>
{
    // LibraryId is optional (lists org-wide types when omitted).
}
