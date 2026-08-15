using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace eDMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SearchVector : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_documents_search_vector;");
            migrationBuilder.Sql("ALTER TABLE documents DROP COLUMN IF EXISTS search_vector;");
        }
    }
}
