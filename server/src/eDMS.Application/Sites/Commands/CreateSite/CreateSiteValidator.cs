using FluentValidation;

namespace eDMS.Application.Sites.Commands.CreateSite;

public sealed class CreateSiteValidator : AbstractValidator<CreateSiteCommand>
{
    public CreateSiteValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.UrlSlug)
            .NotEmpty()
            .MaximumLength(128)
            .Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("URL slug must be lowercase letters, numbers, and single hyphens.");
        RuleFor(command => command.Description).MaximumLength(1024);
    }
}
