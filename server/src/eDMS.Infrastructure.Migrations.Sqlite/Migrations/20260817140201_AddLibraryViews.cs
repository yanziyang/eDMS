using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "library_views",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    library_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    owner_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    filter_config = table.Column<string>(type: "TEXT", maxLength: 16384, nullable: false),
                    sort_config = table.Column<string>(type: "TEXT", maxLength: 16384, nullable: false),
                    group_by_column = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    is_default = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_library_views", x => x.id);
                    table.ForeignKey(
                        name: "fk_library_views_asp_net_users_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_library_views_libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_library_views_library_id_is_default",
                table: "library_views",
                columns: new[] { "library_id", "is_default" });

            migrationBuilder.CreateIndex(
                name: "ix_library_views_library_id_owner_id_name",
                table: "library_views",
                columns: new[] { "library_id", "owner_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_library_views_owner_id",
                table: "library_views",
                column: "owner_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "library_views");
        }
    }
}
