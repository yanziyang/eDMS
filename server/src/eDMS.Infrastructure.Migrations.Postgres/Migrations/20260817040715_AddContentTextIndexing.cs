using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations.Postgres
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
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "extracted_text_version_id",
                table: "documents",
                type: "uuid",
                nullable: true);

            // search_vector is an intentionally raw PostgreSQL generated column
            // (M7.1). Recreate it so persisted Tika text participates in the
            // existing GIN index without leaking provider-specific SQL into the
            // EF model (ADR-5, ADR-8, ADR-13).
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS ix_documents_search_vector;
                ALTER TABLE documents DROP COLUMN IF EXISTS search_vector;
                ALTER TABLE documents ADD COLUMN search_vector tsvector
                    GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                        setweight(to_tsvector('english', coalesce(extracted_text, '')), 'C')
                    ) STORED;
                CREATE INDEX ix_documents_search_vector ON documents USING GIN(search_vector);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_documents_search_vector;");
            migrationBuilder.Sql("ALTER TABLE documents DROP COLUMN IF EXISTS search_vector;");

            migrationBuilder.DropColumn(
                name: "extracted_text",
                table: "documents");

            migrationBuilder.DropColumn(
                name: "extracted_text_version_id",
                table: "documents");

            migrationBuilder.Sql(
                """
                ALTER TABLE documents ADD COLUMN search_vector tsvector
                    GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(description, '')), 'B')
                    ) STORED;
                CREATE INDEX ix_documents_search_vector ON documents USING GIN(search_vector);
                """);
        }
    }
}
