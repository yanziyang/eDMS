using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class AddContentTextIndexing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "extracted_text",
                table: "documents",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "extracted_text_version_id",
                table: "documents",
                type: "char(36)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "extracted_text",
                table: "documents");

            migrationBuilder.DropColumn(
                name: "extracted_text_version_id",
                table: "documents");
        }
    }
}
