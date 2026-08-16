using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class ItemPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "item_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    object_type = table.Column<int>(type: "integer", nullable: false),
                    object_id = table.Column<Guid>(type: "uuid", nullable: false),
                    principal_type = table.Column<int>(type: "integer", nullable: false),
                    principal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    level = table.Column<int>(type: "integer", nullable: false),
                    granted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    granted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_permissions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_item_permissions_object",
                table: "item_permissions",
                columns: new[] { "object_type", "object_id" });

            migrationBuilder.CreateIndex(
                name: "ix_item_permissions_object_type_object_id_principal_type_princ",
                table: "item_permissions",
                columns: new[] { "object_type", "object_id", "principal_type", "principal_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "item_permissions");
        }
    }
}
