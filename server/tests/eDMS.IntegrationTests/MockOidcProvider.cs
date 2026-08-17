using DotNet.Testcontainers.Builders;

namespace eDMS.IntegrationTests;

internal static class MockOidcProvider
{
    public const string Image = "ghcr.io/navikt/mock-oauth2-server:4.0.0";
    public const string IssuerId = "default";
    public const string ClientId = "edms-demo-client";
    public const string ClientSecret = "edms-demo-secret";
    public const string CallbackPath = "/api/v1/auth/sso/oidc/callback";
    public const string DemoLogin = "demo-user";
    public const string DemoExternalId = "oidc-demo-user";
    public const string DemoEmail = "demo-user@edms.local";

    public const string JsonConfiguration = """
        {
          "interactiveLogin": true,
          "tokenCallbacks": [
            {
              "issuerId": "default",
              "requestMappings": [
                {
                  "requestParam": "subject",
                  "match": "demo-user",
                  "claims": {
                    "sub": "oidc-demo-user",
                    "aud": ["edms-demo-client"],
                    "email": "demo-user@edms.local",
                    "email_verified": true,
                    "name": "OIDC Demo User",
                    "preferred_username": "demo-user"
                  }
                }
              ]
            }
          ]
        }
        """;

    public static ContainerBuilder CreateBuilder()
    {
        return new ContainerBuilder(Image)
            .WithExposedPort(8080)
            .WithPortBinding(8080, true)
            .WithEnvironment("JSON_CONFIG", JsonConfiguration)
            .WithWaitStrategy(
                Wait.ForUnixContainer()
                    .UntilHttpRequestIsSucceeded(request => request
                        .ForPort(8080)
                        .ForPath("/isalive")
                        .ForStatusCode(System.Net.HttpStatusCode.OK)));
    }
}
