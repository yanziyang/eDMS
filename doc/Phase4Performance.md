# Phase 4 performance measurements

M31.5 records the first numbers for the two Phase 4 query paths most likely to
grow with activity. These are local regression measurements, not production SLAs;
the assertions use deliberately generous bounds so they catch pathological query
regressions without making CI hardware part of the product contract.

Measurement date: 2026-08-18  
Provider: SQLite in-memory, relational EF Core path  
Command:

```text
$env:MSBUILDUSESERVER='0'; dotnet test server\tests\eDMS.IntegrationTests\eDMS.IntegrationTests.csproj --no-restore --filter FullyQualifiedName~Phase4PerformanceTests --configuration Debug -m:1 -p:UseSharedCompilation=false --logger "console;verbosity=detailed"
```

| Path | Dataset | Measurement | Regression bound |
|---|---|---:|---:|
| M26 Recent view | 1,000 audit entries for 200 documents, one user, 10 measured calls after one warm-up call | 3.38 ms average | `< 500 ms` average |
| M28 followed-change fan-out | 20 folder levels, one document, 500 daily subscriptions split across Site and Library, 5 measured calls after one warm-up call | 71.62 ms average | `< 5,000 ms` average |

The test implementation is `server/tests/eDMS.IntegrationTests/Phase4PerformanceTests.cs`.
