using System.Text.Json;
using eDMS.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace eDMS.Infrastructure.Persistence.Seeding;

public sealed record DefaultContentTypeColumn(
    string Name,
    ColumnDataType DataType,
    bool IsRequired = false,
    IReadOnlyList<string>? ChoiceOptions = null,
    string? DefaultValue = null);

public sealed record DefaultContentTypeDefinition(
    string Name,
    string Description,
    IReadOnlyList<DefaultContentTypeColumn> Columns);

/// <summary>
/// Seeds a small, reusable catalog for local development. The definitions are
/// organization-wide so they do not silently become the active type for every
/// library; administrators can use them as templates when configuring a library.
/// Existing types and columns are never overwritten.
/// </summary>
public sealed class DefaultContentTypeSeeder(
    UserManager<ApplicationUser> userManager,
    AppDbContext db,
    ILogger<DefaultContentTypeSeeder> logger)
{
    public static IReadOnlyList<DefaultContentTypeDefinition> Catalog { get; } =
    [
        new(
            "Document",
            "General-purpose metadata for everyday documents.",
            [
                new("Department", ColumnDataType.Text),
                new("Document Status", ColumnDataType.Choice, ChoiceOptions: ["Draft", "In Review", "Approved", "Archived"]),
                new("Review Date", ColumnDataType.Date),
            ]),
        new(
            "Contract",
            "Metadata for agreements and other legal commitments.",
            [
                new("Contract Number", ColumnDataType.Text),
                new("Counterparty", ColumnDataType.Text),
                new("Effective Date", ColumnDataType.Date),
                new("Expiry Date", ColumnDataType.Date),
                new("Status", ColumnDataType.Choice, ChoiceOptions: ["Draft", "Active", "Expired", "Terminated"]),
            ]),
        new(
            "Invoice",
            "Metadata for supplier and customer invoices.",
            [
                new("Invoice Number", ColumnDataType.Text),
                new("Supplier", ColumnDataType.Text),
                new("Invoice Date", ColumnDataType.Date),
                new("Due Date", ColumnDataType.Date),
                new("Payment Status", ColumnDataType.Choice, ChoiceOptions: ["Draft", "Submitted", "Approved", "Paid", "Rejected"]),
            ]),
        new(
            "Policy",
            "Metadata for policies, standards, and procedures.",
            [
                new("Policy Owner", ColumnDataType.Text),
                new("Effective Date", ColumnDataType.Date),
                new("Review Date", ColumnDataType.Date),
                new("Status", ColumnDataType.Choice, ChoiceOptions: ["Draft", "In Review", "Approved", "Archived"]),
            ]),
        new(
            "Meeting Notes",
            "Metadata for agendas, minutes, and meeting records.",
            [
                new("Meeting Date", ColumnDataType.Date),
                new("Meeting Organizer", ColumnDataType.Text),
                new("Meeting Status", ColumnDataType.Choice, ChoiceOptions: ["Draft", "Final"]),
            ]),
        new(
            "Project Record",
            "Metadata for project plans, reports, and deliverables.",
            [
                new("Project Code", ColumnDataType.Text),
                new("Project Manager", ColumnDataType.Text),
                new("Project Status", ColumnDataType.Choice, ChoiceOptions: ["Planning", "Active", "On Hold", "Closed"]),
                new("Target Date", ColumnDataType.Date),
            ]),
    ];

    public async Task<int> SeedAsync(CancellationToken cancellationToken = default)
    {
        var creatorId = await userManager.Users
            .Where(user => user.IsSystemAdmin && user.IsActive)
            .OrderBy(user => user.CreatedAt)
            .Select(user => (Guid?)user.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (creatorId is not { } systemAdminId)
        {
            logger.LogDebug("Default content-type seed skipped: no active System Administrator exists.");
            return 0;
        }

        var names = Catalog.Select(definition => definition.Name).ToArray();
        var contentTypes = await db.ContentTypes
            .Where(contentType => contentType.LibraryId == null && names.Contains(contentType.Name))
            .ToListAsync(cancellationToken);
        var contentTypeIds = contentTypes.Select(contentType => contentType.Id).ToArray();
        var columns = await db.ColumnDefinitions
            .Where(column => contentTypeIds.Contains(column.ContentTypeId))
            .ToListAsync(cancellationToken);

        var createdContentTypes = 0;
        var createdColumns = 0;
        foreach (var definition in Catalog)
        {
            var contentType = contentTypes.SingleOrDefault(item => item.Name == definition.Name);
            if (contentType is null)
            {
                contentType = new ContentType
                {
                    Name = definition.Name,
                    Description = definition.Description,
                };
                contentType.SetCreator(systemAdminId);
                db.ContentTypes.Add(contentType);
                contentTypes.Add(contentType);
                createdContentTypes++;
            }

            foreach (var definitionColumn in definition.Columns)
            {
                if (columns.Any(column =>
                        column.ContentTypeId == contentType.Id
                        && column.Name == definitionColumn.Name))
                {
                    continue;
                }

                var column = new ColumnDefinition
                {
                    ContentTypeId = contentType.Id,
                    Name = definitionColumn.Name,
                    DataType = definitionColumn.DataType,
                    IsRequired = definitionColumn.IsRequired,
                    ChoiceOptions = definitionColumn.ChoiceOptions is null
                        ? null
                        : JsonSerializer.Serialize(definitionColumn.ChoiceOptions),
                    DefaultValue = definitionColumn.DefaultValue,
                };
                column.SetCreator(systemAdminId);
                db.ColumnDefinitions.Add(column);
                columns.Add(column);
                createdColumns++;
            }
        }

        if (createdContentTypes != 0 || createdColumns != 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Seeded {ContentTypeCount} default content types and {ColumnCount} columns.",
                createdContentTypes,
                createdColumns);
        }

        return createdContentTypes;
    }
}
