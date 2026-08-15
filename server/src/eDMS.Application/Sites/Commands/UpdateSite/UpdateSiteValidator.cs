using FluentValidation;

namespace eDMS.Application.Sites.Commands.UpdateSite;

public sealed class UpdateSiteValidator : AbstractValidator<UpdateSiteCommand>
{
    public UpdateSiteValidator()
    {
        RuleFor(command => command.SiteId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(256);
        RuleFor(command => command.Description).MaximumLength(1024);
        RuleFor(command => command.StorageQuotaBytes).GreaterThan(0).When(command => command.StorageQuotaBytes is not null);
    }
}
