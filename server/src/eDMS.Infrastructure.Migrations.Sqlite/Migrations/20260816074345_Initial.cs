using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    normalized_name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    concurrency_stamp = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    display_name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    auth_provider = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    external_id = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    avatar_url = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    is_system_admin = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    must_change_password = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    last_login_at = table.Column<long>(type: "INTEGER", nullable: true),
                    user_name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    normalized_user_name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true, collation: "NOCASE"),
                    normalized_email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    email_confirmed = table.Column<bool>(type: "INTEGER", nullable: false),
                    password_hash = table.Column<string>(type: "TEXT", nullable: true),
                    security_stamp = table.Column<string>(type: "TEXT", nullable: true),
                    concurrency_stamp = table.Column<string>(type: "TEXT", nullable: true),
                    phone_number = table.Column<string>(type: "TEXT", nullable: true),
                    phone_number_confirmed = table.Column<bool>(type: "INTEGER", nullable: false),
                    two_factor_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    lockout_end = table.Column<long>(type: "INTEGER", nullable: true),
                    lockout_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    access_failed_count = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "item_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    object_type = table.Column<int>(type: "INTEGER", nullable: false),
                    object_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    principal_type = table.Column<int>(type: "INTEGER", nullable: false),
                    principal_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    level = table.Column<int>(type: "INTEGER", nullable: false),
                    granted_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    granted_at = table.Column<long>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_permissions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    url_slug = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    storage_quota_bytes = table.Column<long>(type: "INTEGER", nullable: true),
                    storage_used_bytes = table.Column<long>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    is_deleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    deleted_at = table.Column<long>(type: "INTEGER", nullable: true),
                    deleted_by = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sites", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    role_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    claim_type = table.Column<string>(type: "TEXT", nullable: true),
                    claim_value = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_role_claims", x => x.id);
                    table.ForeignKey(
                        name: "fk_asp_net_role_claims_asp_net_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "AspNetRoles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    claim_type = table.Column<string>(type: "TEXT", nullable: true),
                    claim_value = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_user_claims", x => x.id);
                    table.ForeignKey(
                        name: "fk_asp_net_user_claims_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    login_provider = table.Column<string>(type: "TEXT", nullable: false),
                    provider_key = table.Column<string>(type: "TEXT", nullable: false),
                    provider_display_name = table.Column<string>(type: "TEXT", nullable: true),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_user_logins", x => new { x.login_provider, x.provider_key });
                    table.ForeignKey(
                        name: "fk_asp_net_user_logins_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    role_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_user_roles", x => new { x.user_id, x.role_id });
                    table.ForeignKey(
                        name: "fk_asp_net_user_roles_asp_net_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "AspNetRoles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_asp_net_user_roles_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    login_provider = table.Column<string>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    value = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_asp_net_user_tokens", x => new { x.user_id, x.login_provider, x.name });
                    table.ForeignKey(
                        name: "fk_asp_net_user_tokens_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "audit_log_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    timestamp = table.Column<long>(type: "INTEGER", nullable: false),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    action = table.Column<int>(type: "INTEGER", nullable: false),
                    object_type = table.Column<int>(type: "INTEGER", nullable: false),
                    object_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    object_name = table.Column<string>(type: "TEXT", nullable: false),
                    site_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    details = table.Column<string>(type: "TEXT", nullable: true),
                    ip_address = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_audit_log_entries_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    token_hash = table.Column<string>(type: "TEXT", nullable: false),
                    expires_at = table.Column<long>(type: "INTEGER", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false, defaultValueSql: "now()"),
                    created_by_ip = table.Column<string>(type: "TEXT", nullable: true),
                    revoked_at = table.Column<long>(type: "INTEGER", nullable: true),
                    replaced_by_token_id = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_refresh_tokens_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_refresh_tokens_refresh_tokens_replaced_by_token_id",
                        column: x => x.replaced_by_token_id,
                        principalTable: "refresh_tokens",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    is_system = table.Column<bool>(type: "INTEGER", nullable: false),
                    site_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_groups", x => x.id);
                    table.ForeignKey(
                        name: "fk_groups_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "libraries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    site_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    enable_versioning = table.Column<bool>(type: "INTEGER", nullable: false),
                    enable_minor_versions = table.Column<bool>(type: "INTEGER", nullable: false),
                    require_checkout = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    is_deleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    deleted_at = table.Column<long>(type: "INTEGER", nullable: true),
                    deleted_by = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_libraries", x => x.id);
                    table.ForeignKey(
                        name: "fk_libraries_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "site_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    site_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    principal_type = table.Column<int>(type: "INTEGER", nullable: false),
                    principal_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    role = table.Column<int>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_site_permissions", x => x.id);
                    table.ForeignKey(
                        name: "fk_site_permissions_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "group_members",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    user_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    added_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_members", x => new { x.group_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_group_members_asp_net_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_group_members_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    library_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    parent_folder_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    path = table.Column<string>(type: "TEXT", nullable: false),
                    modified_by = table.Column<Guid>(type: "TEXT", nullable: true),
                    modified_at = table.Column<long>(type: "INTEGER", nullable: true),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    is_deleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    deleted_at = table.Column<long>(type: "INTEGER", nullable: true),
                    deleted_by = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_folders", x => x.id);
                    table.ForeignKey(
                        name: "fk_folders_folders_parent_folder_id",
                        column: x => x.parent_folder_id,
                        principalTable: "folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_folders_libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    library_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    folder_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    title = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    description = table.Column<string>(type: "TEXT", nullable: true),
                    content_type = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    current_version_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    checked_out_by = table.Column<Guid>(type: "TEXT", nullable: true),
                    checked_out_at = table.Column<long>(type: "INTEGER", nullable: true),
                    modified_by = table.Column<Guid>(type: "TEXT", nullable: true),
                    modified_at = table.Column<long>(type: "INTEGER", nullable: true),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    is_deleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    deleted_at = table.Column<long>(type: "INTEGER", nullable: true),
                    deleted_by = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_documents_folders_folder_id",
                        column: x => x.folder_id,
                        principalTable: "folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_documents_libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "document_tags",
                columns: table => new
                {
                    document_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    tag_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_document_tags", x => new { x.document_id, x.tag_id });
                    table.ForeignKey(
                        name: "fk_document_tags_documents_document_id",
                        column: x => x.document_id,
                        principalTable: "documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_document_tags_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "document_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    document_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    version_major = table.Column<int>(type: "INTEGER", nullable: false),
                    version_minor = table.Column<int>(type: "INTEGER", nullable: false),
                    storage_key = table.Column<string>(type: "TEXT", nullable: false),
                    size_bytes = table.Column<long>(type: "INTEGER", nullable: false),
                    checksum = table.Column<string>(type: "TEXT", nullable: false),
                    comment = table.Column<string>(type: "TEXT", nullable: true),
                    is_major = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_document_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_document_versions_documents_document_id",
                        column: x => x.document_id,
                        principalTable: "documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_asp_net_role_claims_role_id",
                table: "AspNetRoleClaims",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "normalized_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_asp_net_user_claims_user_id",
                table: "AspNetUserClaims",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_asp_net_user_logins_user_id",
                table: "AspNetUserLogins",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_asp_net_user_roles_role_id",
                table: "AspNetUserRoles",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "normalized_email");

            migrationBuilder.CreateIndex(
                name: "ix_asp_net_users_email",
                table: "AspNetUsers",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "normalized_user_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_site_timestamp",
                table: "audit_log_entries",
                columns: new[] { "site_id", "timestamp" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_timestamp",
                table: "audit_log_entries",
                column: "timestamp",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_user",
                table: "audit_log_entries",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_document_tags_tag_id",
                table: "document_tags",
                column: "tag_id");

            migrationBuilder.CreateIndex(
                name: "ix_document_versions_document_id_version_major_version_minor",
                table: "document_versions",
                columns: new[] { "document_id", "version_major", "version_minor" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_documents_folder",
                table: "documents",
                columns: new[] { "library_id", "folder_id" });

            migrationBuilder.CreateIndex(
                name: "ix_documents_folder_id",
                table: "documents",
                column: "folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_folders_library_parent",
                table: "folders",
                columns: new[] { "library_id", "parent_folder_id" });

            migrationBuilder.CreateIndex(
                name: "ix_folders_parent_folder_id",
                table: "folders",
                column: "parent_folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_members_user_id",
                table: "group_members",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_groups_name",
                table: "groups",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_groups_site_id",
                table: "groups",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_item_permissions_object",
                table: "item_permissions",
                columns: new[] { "object_type", "object_id" });

            migrationBuilder.CreateIndex(
                name: "ix_item_permissions_object_type_object_id_principal_type_principal_id",
                table: "item_permissions",
                columns: new[] { "object_type", "object_id", "principal_type", "principal_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_libraries_site_id",
                table: "libraries",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_replaced_by_token_id",
                table: "refresh_tokens",
                column: "replaced_by_token_id");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_token_hash",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_site_permissions_site_id_principal_type_principal_id",
                table: "site_permissions",
                columns: new[] { "site_id", "principal_type", "principal_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sites_url_slug",
                table: "sites",
                column: "url_slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tags_name",
                table: "tags",
                column: "name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "audit_log_entries");

            migrationBuilder.DropTable(
                name: "document_tags");

            migrationBuilder.DropTable(
                name: "document_versions");

            migrationBuilder.DropTable(
                name: "group_members");

            migrationBuilder.DropTable(
                name: "item_permissions");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "site_permissions");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "documents");

            migrationBuilder.DropTable(
                name: "groups");

            migrationBuilder.DropTable(
                name: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "folders");

            migrationBuilder.DropTable(
                name: "libraries");

            migrationBuilder.DropTable(
                name: "sites");
        }
    }
}
