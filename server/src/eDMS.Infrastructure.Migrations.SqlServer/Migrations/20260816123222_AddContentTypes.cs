using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.SqlServer.Migrations
{
    /// <inheritdoc />
    public partial class AddContentTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "content_type_id",
                table: "documents",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "content_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    library_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    description = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_types", x => x.id);
                    table.ForeignKey(
                        name: "fk_content_types_libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "column_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    content_type_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    data_type = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    choice_options = table.Column<string>(type: "nvarchar(max)", maxLength: 4096, nullable: true),
                    default_value = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_column_definitions", x => x.id);
                    table.ForeignKey(
                        name: "fk_column_definitions_content_types_content_type_id",
                        column: x => x.content_type_id,
                        principalTable: "content_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "document_column_values",
                columns: table => new
                {
                    document_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    column_definition_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    value = table.Column<string>(type: "nvarchar(max)", maxLength: 4096, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_document_column_values", x => new { x.document_id, x.column_definition_id });
                    table.ForeignKey(
                        name: "fk_document_column_values_column_definitions_column_definition_id",
                        column: x => x.column_definition_id,
                        principalTable: "column_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_document_column_values_documents_document_id",
                        column: x => x.document_id,
                        principalTable: "documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_documents_content_type_id",
                table: "documents",
                column: "content_type_id");

            migrationBuilder.CreateIndex(
                name: "ix_column_definitions_content_type_id_name",
                table: "column_definitions",
                columns: new[] { "content_type_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_content_types_library_id",
                table: "content_types",
                column: "library_id");

            migrationBuilder.CreateIndex(
                name: "ix_document_column_values_column_definition_id",
                table: "document_column_values",
                column: "column_definition_id");

            migrationBuilder.AddForeignKey(
                name: "fk_documents_content_types_content_type_id",
                table: "documents",
                column: "content_type_id",
                principalTable: "content_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_documents_content_types_content_type_id",
                table: "documents");

            migrationBuilder.DropTable(
                name: "document_column_values");

            migrationBuilder.DropTable(
                name: "column_definitions");

            migrationBuilder.DropTable(
                name: "content_types");

            migrationBuilder.DropIndex(
                name: "ix_documents_content_type_id",
                table: "documents");

            migrationBuilder.DropColumn(
                name: "content_type_id",
                table: "documents");
        }
    }
}
