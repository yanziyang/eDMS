using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class AddFavoriteItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "favorite_items",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "char(36)", nullable: false),
                    object_type = table.Column<int>(type: "int", nullable: false),
                    object_id = table.Column<Guid>(type: "char(36)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_favorite_items", x => new { x.user_id, x.object_type, x.object_id });
                    table.ForeignKey(
                        name: "fk_favorite_items_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "ix_favorite_items_object_type_object_id",
                table: "favorite_items",
                columns: new[] { "object_type", "object_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "favorite_items");
        }
    }
}
