using eDMS.Application;
using eDMS.Application.Auth;
using eDMS.Application.Common.Interfaces;
using eDMS.Api.Auth;
using eDMS.Api.Controllers;
using eDMS.Domain;
using eDMS.Infrastructure;
using eDMS.Infrastructure.Options;
using eDMS.Infrastructure.Persistence;
using eDMS.Infrastructure.Persistence.Seeding;
using eDMS.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using Serilog;

namespace eDMS.Api;

public class Program
{
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .WriteTo.Console());

        builder.Services
            .AddControllers()
            .AddJsonOptions(options =>
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        builder.Services.AddOpenApi();
        builder.Services.AddHealthChecks();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentUser, CurrentUser>();
        builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
        builder.Services.AddProblemDetails();

        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(
                Path.Combine(builder.Environment.ContentRootPath, "dataprotection-keys")))
            .SetApplicationName("eDMS");

        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddFixedWindowLimiter("auth", limiter =>
            {
                limiter.PermitLimit = 10;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });
        });

        // Database provider (ADR-8): explicit configuration wins; local development
        // defaults to SQLite, everything else to PostgreSQL.
        var databaseProvider = builder.Configuration["Database:Provider"]
            ?? (builder.Environment.IsDevelopment() ? "Sqlite" : "Postgres");

        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration, databaseProvider, builder.Environment.ContentRootPath);
        builder.Services.AddSingleton<SamlConfigurationProvider>();

        var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? new JwtOptions();
        var oidcOptions = builder.Configuration.GetSection(OidcOptions.SectionName).Get<OidcOptions>()
            ?? new OidcOptions();
        var keyMaterial = new TokenKeyMaterial(jwtOptions);
        builder.Services.AddSingleton(keyMaterial);

        builder.Services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddEntityFrameworkStores<AppDbContext>();

        var authentication = builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = keyMaterial.ValidationKey,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                };
            });

        if (!string.IsNullOrWhiteSpace(oidcOptions.Authority))
        {
            authentication
                .AddCookie(SsoAuthenticationSchemes.CorrelationCookie, options =>
                {
                    options.Cookie.Name = SsoAuthenticationSchemes.CorrelationCookie;
                    options.Cookie.HttpOnly = true;
                    options.Cookie.SameSite = SameSiteMode.Lax;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                    options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
                    options.SlidingExpiration = false;
                })
                .AddOpenIdConnect(SsoAuthenticationSchemes.Oidc, options =>
                {
                    options.SignInScheme = SsoAuthenticationSchemes.CorrelationCookie;
                    options.Authority = oidcOptions.Authority;
                    options.ClientId = oidcOptions.ClientId;
                    options.ClientSecret = oidcOptions.ClientSecret;
                    options.CallbackPath = oidcOptions.CallbackPath;
                    options.RequireHttpsMetadata = oidcOptions.RequireHttpsMetadata;
                    options.ResponseType = OpenIdConnectResponseType.Code;
                    options.UsePkce = true;
                    options.SaveTokens = false;
                    options.GetClaimsFromUserInfoEndpoint = false;
                    if (builder.Environment.IsEnvironment("Testing"))
                    {
                        // WebApplicationFactory exercises the callback over HTTP. The
                        // framework default is Secure=Always for remote-auth
                        // correlation cookies, which is correct for production HTTPS
                        // but prevents the test browser from returning the cookie.
                        options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                    }
                    options.Scope.Clear();
                    options.Scope.Add("openid");
                    options.Scope.Add("profile");
                    options.Scope.Add("email");
                    options.Events = new OpenIdConnectEvents
                    {
                        OnTokenValidated = context => SsoController.HandleOidcTokenValidatedAsync(
                            context,
                            builder.Configuration.GetSection(ClientOptions.SectionName).Get<ClientOptions>()
                                ?? new ClientOptions()),
                        OnRemoteFailure = context =>
                        {
                            SsoController.HandleOidcRemoteFailure(
                                context,
                                builder.Configuration.GetSection(ClientOptions.SectionName).Get<ClientOptions>()
                                    ?? new ClientOptions());
                            return Task.CompletedTask;
                        },
                    };
                });
        }

        builder.Services.AddAuthorization(options =>
            options.AddPolicy("SystemAdmin", policy => policy.RequireClaim("is_admin", "true")));

        var clientBaseUrl = builder.Configuration["Client:BaseUrl"] ?? "http://localhost:5173";
        builder.Services.AddCors(options =>
            options.AddPolicy("spa", policy =>
                policy.WithOrigins(clientBaseUrl)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()));

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseSerilogRequestLogging();
        app.UseExceptionHandler();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseCors("spa");
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
        app.MapHealthChecks("/health");

        if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
        {
            using var migrationScope = app.Services.CreateScope();
            var db = migrationScope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (db.Database.IsRelational())
            {
                await db.Database.MigrateAsync();
            }
        }

        await SeedAdministratorAsync(app);

        app.Run();
    }

    private static async Task SeedAdministratorAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<AdminSeeder>();
        await seeder.SeedAsync();
    }
}
