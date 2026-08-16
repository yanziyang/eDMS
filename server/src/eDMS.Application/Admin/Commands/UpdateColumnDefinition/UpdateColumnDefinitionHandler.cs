using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.UpdateColumnDefinition;

public sealed record UpdateColumnDefinitionCommand(
    Guid ColumnDefinitionId,
    string Name,
    ColumnDataType DataType,
    bool IsRequired,
    string? ChoiceOptions,
    string? DefaultValue) : IRequest;

public sealed class UpdateColumnDefinitionHandler(IAppDbContext db) : IRequestHandler<UpdateColumnDefinitionCommand>
{
    public async Task Handle(UpdateColumnDefinitionCommand command, CancellationToken cancellationToken)
    {
        var column = await db.ColumnDefinitions
            .SingleOrDefaultAsync(item => item.Id == command.ColumnDefinitionId, cancellationToken)
            ?? throw new NotFoundException(nameof(ColumnDefinition), command.ColumnDefinitionId);

        var duplicate = await db.ColumnDefinitions.AnyAsync(
            item => item.Id != command.ColumnDefinitionId
                && item.ContentTypeId == column.ContentTypeId
                && item.Name == command.Name,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A column with this name already exists.");
        }

        column.Name = command.Name;
        column.DataType = command.DataType;
        column.IsRequired = command.IsRequired;
        column.ChoiceOptions = command.ChoiceOptions;
        column.DefaultValue = command.DefaultValue;
        await db.SaveChangesAsync(cancellationToken);
    }
}
