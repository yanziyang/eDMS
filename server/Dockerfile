FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/eDMS.Domain/eDMS.Domain.csproj src/eDMS.Domain/
COPY src/eDMS.Application/eDMS.Application.csproj src/eDMS.Application/
COPY src/eDMS.Infrastructure/eDMS.Infrastructure.csproj src/eDMS.Infrastructure/
COPY src/eDMS.Api/eDMS.Api.csproj src/eDMS.Api/
RUN dotnet restore src/eDMS.Api/eDMS.Api.csproj

COPY . .
WORKDIR /src/src/eDMS.Api
RUN dotnet publish eDMS.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "eDMS.Api.dll"]
