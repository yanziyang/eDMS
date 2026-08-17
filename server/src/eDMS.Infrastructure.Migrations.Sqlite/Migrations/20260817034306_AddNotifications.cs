using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_subscriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    object_type = table.Column<int>(type: "INTEGER", nullable: false),
                    object_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    frequency = table.Column<int>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_subscriptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_alert_subscriptions_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    kind = table.Column<int>(type: "INTEGER", nullable: false),
                    object_type = table.Column<int>(type: "INTEGER", nullable: false),
                    object_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    object_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    message = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    frequency = table.Column<int>(type: "INTEGER", nullable: false),
                    is_read = table.Column<bool>(type: "INTEGER", nullable: false),
                    read_at = table.Column<long>(type: "INTEGER", nullable: true),
                    email_sent_at = table.Column<long>(type: "INTEGER", nullable: true),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_notifications_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_alert_subscriptions_object_id",
                table: "alert_subscriptions",
                column: "object_id");

            migrationBuilder.CreateIndex(
                name: "ix_alert_subscriptions_user_id_object_type_object_id",
                table: "alert_subscriptions",
                columns: new[] { "user_id", "object_type", "object_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_notifications_email_sent_at_frequency_created_at",
                table: "notifications",
                columns: new[] { "email_sent_at", "frequency", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_created_at",
                table: "notifications",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_is_read_created_at",
                table: "notifications",
                columns: new[] { "user_id", "is_read", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_subscriptions");

            migrationBuilder.DropTable(
                name: "notifications");
        }
    }
}
