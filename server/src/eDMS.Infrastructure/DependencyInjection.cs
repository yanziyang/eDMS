using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Auditing;
using eDMS.Infrastructure.Admin;
using eDMS.Application.Admin;
using eDMS.Infrastructure.Email;
using eDMS.Infrastructure.Office;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Persistence.Seeding;
using eDMS.Infrastructure.Security;
using eDMS.Infrastructure.Sharing;
using eDMS.Infrastructure.Storage;
using eDMS.Infrastructure.Documents;
using eDMS.Application.Documents;
using eDMS.Infrastructure.Background;
using eDMS.Infrastructure.Permissions;
using eDMS.Application.Permissions;
using eDMS.Application.RecycleBin;
using eDMS.Infrastructure.RecycleBin;
using eDMS.Infrastructure.Search;
using eDMS.Infrastructure.Uploads;
using eDMS.Application.Search;
using eDMS.Application.Sharing;
using eDMS.Application.Uploads;
using eDMS.Infrastructure.Notifications;
using eDMS.Application.Notifications;
using eDMS.Infrastructure.Favorites;
using eDMS.Infrastructure.Recent;
using eDMS.Application.Favorites;
using eDMS.Application.Recent;
using eDMS.Infrastructure.LibraryViews;
using eDMS.Application.LibraryViews;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace eDMS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string databaseProvider,
        string contentRoot)
    {
        var provider = DatabaseProviderParser.Parse(databaseProvider);
        var connectionString = ResolveConnectionString(configuration, provider, contentRoot);

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSnakeCaseNamingConvention();
            switch (provider)
            {
                case DatabaseProvider.Postgres:
                    options.UseNpgsql(connectionString, npgsql =>
                        npgsql.MigrationsAssembly("eDMS.Infrastructure.Migrations.Postgres"));
                    break;

                case DatabaseProvider.SqlServer:
                    options.UseSqlServer(connectionString, sqlServer =>
                        sqlServer.MigrationsAssembly("eDMS.Infrastructure.Migrations.SqlServer"));
                    break;

                case DatabaseProvider.MySql:
                    options.UseMySQL(connectionString, mySql =>
                        mySql.MigrationsAssembly("eDMS.Infrastructure.Migrations.MySql"));
                    break;

                case DatabaseProvider.Sqlite:
                    options.UseSqlite(connectionString, sqlite =>
                        sqlite.MigrationsAssembly("eDMS.Infrastructure.Migrations.Sqlite"));
                    break;
            }
        });
        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.AddScoped<AdminSeeder>();
        services.AddScoped<DefaultContentTypeSeeder>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));
        services.Configure<ClientOptions>(configuration.GetSection(ClientOptions.SectionName));
        services.Configure<OidcOptions>(configuration.GetSection(OidcOptions.SectionName));
        services.Configure<SamlOptions>(configuration.GetSection(SamlOptions.SectionName));
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.Configure<RecycleBinOptions>(configuration.GetSection(RecycleBinOptions.SectionName));
        services.Configure<OfficeConversionOptions>(configuration.GetSection(OfficeConversionOptions.SectionName));
        services.Configure<TextExtractionOptions>(configuration.GetSection(TextExtractionOptions.SectionName));
        services.AddHttpClient<IOfficeConversionService, HttpOfficeConversionService>((services, client) =>
        {
            var options = services.GetRequiredService<IOptions<OfficeConversionOptions>>().Value;
            client.Timeout = options.Timeout;
        });
        services.AddHttpClient<IContentTextExtractor, HttpContentTextExtractor>((services, client) =>
        {
            var options = services.GetRequiredService<IOptions<TextExtractionOptions>>().Value;
            client.Timeout = options.Timeout;
        });
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IJitProvisioningService, JitProvisioningService>();
        services.AddScoped<ISsoHandoffCodeStore, SsoHandoffCodeStore>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IPermissionResolver, PermissionResolver>();
        services.AddSingleton<IPermissionCacheInvalidator, PermissionCacheInvalidator>();
        services.AddScoped<IAppSettings, AppSettingsStore>();
        services.AddScoped<IEmailSender, EmailSender>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IRecycleBinService, RecycleBinService>();
        services.AddScoped<ISearchService, SearchService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IChunkedUploadService, ChunkedUploadService>();
        services.AddScoped<IShareLinkService, ShareLinkService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IFavoritesService, FavoritesService>();
        services.AddScoped<IRecentService, RecentService>();
        services.AddScoped<ILibraryViewService, LibraryViewService>();
        services.AddScoped<ContentTextIndexer>();
        services.AddSingleton<IFileStorageProvider, LocalDiskFileStorageProvider>();
        services.AddMemoryCache();
        services.AddHostedService<OrphanedUploadSweepService>();
        services.AddHostedService<RecycleBinPurgeService>();
        services.AddHostedService<NotificationDigestService>();
        services.AddHostedService<ContentTextIndexingService>();

        return services;
    }

    private static string ResolveConnectionString(
        IConfiguration configuration,
        DatabaseProvider provider,
        string contentRoot)
    {
        var connectionString = configuration.GetConnectionString("Default") ?? string.Empty;
        if (provider != DatabaseProvider.Sqlite)
        {
            return connectionString;
        }

        // SQLite is the local-development provider: default to a file in the API
        // content root, and anchor bare relative file names there too so the dev
        // database location does not depend on the process working directory.
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.DataSource))
        {
            builder.DataSource = Path.Combine(contentRoot, "edms-dev.db");
        }
        else if (IsBareFileName(builder.DataSource))
        {
            builder.DataSource = Path.Combine(contentRoot, builder.DataSource);
        }

        return builder.ToString();
    }

    private static bool IsBareFileName(string dataSource) =>
        dataSource != ":memory:"
        && !dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
        && (Path.GetDirectoryName(dataSource) is null or "");
}
