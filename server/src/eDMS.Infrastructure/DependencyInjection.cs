using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Infrastructure.Auth;
using eDMS.Infrastructure.Auditing;
using eDMS.Infrastructure.Admin;
using eDMS.Application.Admin;
using eDMS.Infrastructure.Email;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Persistence.Seeding;
using eDMS.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace eDMS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default");

        services.AddDbContext<AppDbContext>(options =>
            options
                .UseNpgsql(connectionString)
                .UseSnakeCaseNamingConvention());
        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.AddScoped<AdminSeeder>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));
        services.Configure<ClientOptions>(configuration.GetSection(ClientOptions.SectionName));
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IPermissionResolver, PermissionResolver>();
        services.AddSingleton<IPermissionCacheInvalidator, PermissionCacheInvalidator>();
        services.AddScoped<IEmailSender, EmailSender>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddMemoryCache();

        return services;
    }
}
