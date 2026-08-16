using eDMS.Application.Common.Exceptions;
using eDMS.Application.Common.Interfaces;
using eDMS.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace eDMS.Application.Admin.Commands.AddColumnDefinition;

public sealed record AddColumnDefinitionCommand(
    Guid ContentTypeId,
    string Name,
    ColumnDataType DataType,
    bool IsRequired,
    string? ChoiceOptions,
    string? DefaultValue) : IRequest<Guid>;

public sealed class AddColumnDefinitionHandler(
    IAppDbContext db,
    ICurrentUser currentUser) : IRequestHandler<AddColumnDefinitionCommand, Guid>
{
    public async Task<Guid> Handle(AddColumnDefinitionCommand command, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();

        var contentTypeExists = await db.ContentTypes.AnyAsync(
            contentType => contentType.Id == command.ContentTypeId,
            cancellationToken);
        if (!contentTypeExists)
        {
            throw new NotFoundException(nameof(ContentType), command.ContentTypeId);
        }

        var duplicate = await db.ColumnDefinitions.AnyAsync(
            column => column.ContentTypeId == command.ContentTypeId && column.Name == command.Name,
            cancellationToken);
        if (duplicate)
        {
            throw new ConflictException("A column with this name already exists.");
        }

        var column = new ColumnDefinition
        {
            ContentTypeId = command.ContentTypeId,
            Name = command.Name,
            DataType = command.DataType,
            IsRequired = command.IsRequired,
            ChoiceOptions = command.ChoiceOptions,
            DefaultValue = command.DefaultValue,
        };
        column.SetCreator(userId);

        db.ColumnDefinitions.Add(column);
        await db.SaveChangesAsync(cancellationToken);
        return column.Id;
    }
}
