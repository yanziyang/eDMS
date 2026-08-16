using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.DeleteColumnDefinition;

public sealed record DeleteColumnDefinitionCommand(Guid ColumnDefinitionId) : IRequest;

public sealed class DeleteColumnDefinitionHandler(IAppDbContext db) : IRequestHandler<DeleteColumnDefinitionCommand>
{
    public async Task Handle(DeleteColumnDefinitionCommand command, CancellationToken cancellationToken)
    {
        var column = await db.ColumnDefinitions
            .SingleOrDefaultAsync(item => item.Id == command.ColumnDefinitionId, cancellationToken)
            ?? throw new NotFoundException(nameof(ColumnDefinition), command.ColumnDefinitionId);

        db.ColumnDefinitions.Remove(column);
        await db.SaveChangesAsync(cancellationToken);
    }
}
