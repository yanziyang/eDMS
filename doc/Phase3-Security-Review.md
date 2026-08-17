# Phase 3 Federation Security Review

Date: 2026-08-17  
Milestone: M23.5  
Scope: OIDC Authorization Code Flow, SAML Web SSO, handoff-code exchange, SSO enforcement, and the browser completion route.

## Conclusion

All five M23.5 security checks passed. The review combined source inspection with real callback integration tests against the Testcontainers-backed mock OIDC and SimpleSAMLphp providers.

| Check | Evidence | Result |
|---|---|---|
| No access/refresh token or SAML assertion leaks through a URL, browser history entry, or server log | `Program.cs` sets `SaveTokens = false`; both server flows redirect only a short-lived handoff code; the SAML assertion is accepted only by the form-POST ACS; `sso-complete.tsx` replaces the callback URL before exchange; the OIDC/SAML E2E and integration tests assert token-free navigation/request URLs; request logging records the request path, while the SAML rejection log does not include assertion data. | PASS |
| Deactivated accounts cannot regain access through federation | `OidcSsoFlowTests.Deactivated_user_cannot_reenter_through_real_oidc_callback` and the SAML flow's deactivation callback assertion both deactivate the provisioned account, then drive the real provider callback and require the provider-error/401 rejection path. | PASS |
| Handoff codes cannot be replayed or used after expiry | Both real provider flows exchange their issued code once and require 401 on a second exchange. `SsoHandoffCodeStoreTests` also verifies expiry and single-use persistence behavior. | PASS |
| Global SSO safety rail prevents total admin lockout | `AdminSettingsApiTests.Global_sso_enforcement_rejects_total_admin_lockout` performs the real `PUT /api/v1/admin/settings`, requires the `urn:edms:sso-safety-rail` conflict, then verifies enabling succeeds after an exemption is restored. | PASS |
| Invalid federation signatures are rejected | The SAML flow rejects a modified response and an unsigned response. `OidcSsoFlowTests.Oidc_callback_rejects_a_token_with_an_invalid_signature` tampers the real provider's `id_token` response and requires the provider-error redirect with no handoff code. | PASS |

## Token-handling decisions verified

- OIDC uses Authorization Code + PKCE and does not save provider tokens in the authentication ticket.
- The provider callback creates a one-time, database-backed handoff code. Application access and refresh tokens are returned only from the authenticated POST exchange response; they are not placed in redirect URLs.
- The SPA removes the handoff code with history replacement before exchanging it, so the visible completion URL and the replacement history entry contain neither the code nor any token.
- SAML uses an HTTP-POST ACS. The server validates the response signature, status, issuer/audience, and request correlation before provisioning or issuing a handoff code. Rejected assertions are logged only as a generic rejection event.

## Verification commands

The container-backed federation tests passed locally:

```text
dotnet test server/tests/eDMS.IntegrationTests/eDMS.IntegrationTests.csproj --no-restore --configuration Debug -m:1 -p:UseSharedCompilation=false --filter "FullyQualifiedName~OidcSsoFlowTests|FullyQualifiedName~SamlSsoFlowTests"
Passed: 4, Failed: 0, Skipped: 0

dotnet test server/tests/eDMS.IntegrationTests/eDMS.IntegrationTests.csproj --no-build --configuration Debug -m:1 -p:UseSharedCompilation=false --filter "FullyQualifiedName~SsoHandoffCodeStoreTests|FullyQualifiedName~AdminSettingsApiTests"
Passed: 8, Failed: 0, Skipped: 0
```

The full repository quality gates and GitHub checks remain the final handoff verification for this milestone. Existing NU1903 dependency advisories are reported separately by the build and are not caused by the federation changes.
