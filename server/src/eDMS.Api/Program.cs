using eDMS.Application;
using eDMS.Infrastructure;
using Serilog;

namespace eDMS.Api;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .WriteTo.Console());

        builder.Services.AddControllers();
        builder.Services.AddOpenApi();
        builder.Services.AddHealthChecks();

        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration);

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseSerilogRequestLogging();
        app.UseHttpsRedirection();
        app.UseAuthorization();

        app.MapControllers();
        app.MapHealthChecks("/health");

        app.Run();
    }
}
