using FluentValidation;

namespace eDMS.Application.Documents.Queries.GetDocumentMetadata;

public sealed class GetDocumentMetadataValidator : AbstractValidator<GetDocumentMetadataQuery>
{
    public GetDocumentMetadataValidator()
    {
        RuleFor(query => query.DocumentId).NotEmpty();
    }
}
