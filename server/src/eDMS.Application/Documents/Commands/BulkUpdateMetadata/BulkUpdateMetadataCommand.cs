using FluentValidation;
using MediatR;

namespace eDMS.Application.Documents.Commands.BulkUpdateMetadata;

public sealed record BulkUpdateMetadataCommand(
    IReadOnlyList<Guid> DocumentIds,
    bool UpdateTitle,
    string? Title,
    bool UpdateDescription,
    string? Description,
    bool UpdateTags,
    IReadOnlyList<string>? Tags,
    IReadOnlyList<BulkMetadataColumnInput>? Columns) : IRequest<BulkMetadataUpdateResult>;

public sealed class BulkUpdateMetadataValidator : AbstractValidator<BulkUpdateMetadataCommand>
{
    public BulkUpdateMetadataValidator()
    {
        RuleFor(command => command.DocumentIds)
            .NotEmpty()
            .Must(ids => ids is not null && ids.Distinct().Count() == ids.Count)
            .WithMessage("Document IDs must be unique.")
            .Must(ids => ids is not null && ids.Count <= 100)
            .WithMessage("A maximum of 100 documents may be updated at once.");
        RuleForEach(command => command.DocumentIds).NotEmpty();
        RuleFor(command => command.Title).MaximumLength(512);
        RuleFor(command => command.Description).MaximumLength(4096);
        RuleForEach(command => command.Tags)
            .NotEmpty()
            .MaximumLength(128);
        RuleFor(command => command.Tags)
            .NotNull()
            .When(command => command.UpdateTags);
        RuleForEach(command => command.Columns).SetValidator(new BulkMetadataColumnInputValidator());
        RuleFor(command => command)
            .Must(command => command.UpdateTitle
                || command.UpdateDescription
                || command.UpdateTags
                || (command.Columns?.Count ?? 0) > 0)
            .WithMessage("At least one metadata field must be selected.");
    }

    private sealed class BulkMetadataColumnInputValidator : AbstractValidator<BulkMetadataColumnInput>
    {
        public BulkMetadataColumnInputValidator()
        {
            RuleFor(input => input.Name).NotEmpty().MaximumLength(128);
            RuleFor(input => input.Value).MaximumLength(4096);
        }
    }
}

public sealed class BulkUpdateMetadataHandler(IDocumentService documents)
    : IRequestHandler<BulkUpdateMetadataCommand, BulkMetadataUpdateResult>
{
    public Task<BulkMetadataUpdateResult> Handle(
        BulkUpdateMetadataCommand command,
        CancellationToken cancellationToken) =>
        documents.BulkUpdateMetadataAsync(
            new BulkMetadataUpdateRequest(
                command.DocumentIds,
                command.UpdateTitle,
                command.Title,
                command.UpdateDescription,
                command.Description,
                command.UpdateTags,
                command.Tags,
                command.Columns ?? []),
            cancellationToken);
}
