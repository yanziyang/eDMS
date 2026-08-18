# Phase 4 validation audit

Audit completed for M31.2 on 2026-08-18.

The application-wide `ValidatorCoverageTests` test discovers every MediatR
`IBaseRequest` in `eDMS.Application`, resolves `IValidator<T>` from the real
application service registration, and fails when no validator is registered.
The audit also names the two Phase 4 MediatR commands explicitly so a future
refactor cannot accidentally move them outside the discovered request set:

| Phase 4 surface | Request boundary | Validator / validation boundary | Result |
|---|---|---|---|
| M24 storage quota | `UpdateSiteCommand` | `UpdateSiteValidator`, registered by `AddValidatorsFromAssembly` | Covered |
| M25 favorites | `FavoritesController` + `IFavoritesService` | `ObjectType` model binding and service permission/object validation; no MediatR command | Covered by service boundary |
| M26 Recent | `RecentController` + `IRecentService` | No request body or user-supplied query parameters; caller identity and permission filtering are enforced in the service | Covered by service boundary |
| M27 saved views | `CreateLibraryViewRequest` / `UpdateLibraryViewRequest` | `LibraryViewService.NormalizeName`, `NormalizeGroupByColumn`, and `LibraryViewConfigSerializer.NormalizeObject`; authorization is checked before writes | Covered by service boundary |
| M28 follow | `NotificationsController` + `INotificationService` | `ObjectType`/`AlertFrequency` model binding and service object, permission, and subscription checks | Covered by service boundary |
| M29 bulk metadata | `BulkUpdateMetadataCommand` | `BulkUpdateMetadataValidator`, including nested column validation and the non-empty-change invariant | Covered |
| M30 context menu | Frontend composite only | Permission filtering is presentation logic; server-side mutation authorization remains authoritative | Covered by server boundary |

The generic test is the authoritative gate for all MediatR commands and
queries, while the table records why the Phase 4 controller/service request
shapes that are intentionally outside MediatR do not have a missing
FluentValidation registration.
