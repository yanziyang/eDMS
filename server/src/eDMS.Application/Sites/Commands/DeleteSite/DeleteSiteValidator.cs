using FluentValidation;
using MediatR;

namespace eDMS.Application.Sites.Commands.DeleteSite;

public sealed class DeleteSiteValidator : AbstractValidator<DeleteSiteCommand>
{
    public DeleteSiteValidator()
    {
        RuleFor(command => command.SiteId).NotEmpty();
    }
}
