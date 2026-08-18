=======================================================
-------------------------------------------------------
Functional Spec
-------------------------------------------------------
Prompt:

I want to build an enterprise document management system for internal uses. Functionality and UI shall be similar to SharePoint Online, but only need key functions.

Tech stack:
- Frontend: React, Vite, strict TypeScript, React Router
- Design system: shadcn
- Styling: Tailwind CSS 4
- Backend: .NET 10, Entity Framework
- Authentication: Database authentication first, support SAML2 and OIDC in future
- Database is PostgreSQL

Create functional spec first, save in 'doc' folder. One in markdown format for coding agent, another one in html format for human to read.

=======================================================
-------------------------------------------------------
HTML Prototype
-------------------------------------------------------
Prompt:

Based on function spec 'doc\functional-spec.md', create HTML Prototype for team member and management to visualise the system.

Requirement for the html prototype:
- Prototype shall be comprehensive as much as possible.
- Save the html prototype in 'prototype(html)' folder.
- The prototype need clickable for the full process, from login to dashbord, statistics report.
- The prototype shall be as comprehensive as possible, cover most of essential use cases.
- The UI need responsive, support mobile device such as tablet etc.
- Use shadcn for UI/UX design.
- Provide four different themes. User can change themes from My Profile or Preference web page.

-------------------------------------------------------
Prompt:

Update html prototype based on latest function spec 'doc\functional-spec.md'.HTML prototype is in 'prototype(html)' folder.

=======================================================
-------------------------------------------------------
React Prototype
-------------------------------------------------------
Prompt:

Based on function spec 'doc\functional-spec.md', create HTML Prototype for team member and management to visualise the system.

Requirement for the html prototype:
- Prototype shall be comprehensive as much as possible.
- Save the html prototype in 'prototype(html)' folder.
- The prototype need clickable for the full process, from login to dashbord, statistics report.
- The prototype shall be as comprehensive as possible, cover most of essential use cases.
- The UI need responsive, support mobile device such as tablet etc.
- Use shadcn for UI/UX design.
- Provide four different themes. User can change themes from My Profile or Preference web page.

-------------------------------------------------------
Prompt:

Update React prototype based on latest function spec 'doc\functional-spec.md'.React prototype is in 'prototype(React)' folder.

=======================================================
-------------------------------------------------------
Prototype Document
-------------------------------------------------------
Prompt:

Generate "Prototype.docx" in "doc" folder. Put in screenshots of the prototype with detailed explanation of each web page. Word document use A3 page size.

=======================================================
-------------------------------------------------------
design spec
-------------------------------------------------------
Prompt:

Next, create technical design spec, save in 'doc' folder. One in markdown format for coding agent, another one in html format for human to read.

=======================================================
-------------------------------------------------------
AGENTS.md
-------------------------------------------------------
Prompt:

The implementation will be done by other AI Coding Agent such as OpenCode + DeepSeek. Create AGENTS.md for other coding agents. Reference functional spec and design spec markdown files in 'doc' folder as progressive disclosure.

=======================================================
-------------------------------------------------------
Implementation Plan
-------------------------------------------------------
Prompt:

The implementation will be done by other AI Coding Agent such as OpenCode + DeepSeek. Create detailed Implementation Plan and save as 'doc\ImplementationPlan.md'.

-------------------------------------------------------
Prompt:

The coding agent has basically finished the implementation plan, refer to the updated document. Rename existing Implementation Plan as 'doc\ImplementationPlan V1.0.md'

Next, plan the next phase Implementation Plan and save as 'doc\ImplementationPlan V1.1.md'. Please note that the implementation will be done by other AI Coding Agent such as OpenCode + DeepSeek.

-------------------------------------------------------
Prompt:

The coding agent has basically finished the implementation plan V1.1, refer to the updated document.

Next, plan the next phase Implementation Plan and save as 'doc\ImplementationPlan V1.2.md'. Please note that the implementation will be done by other AI Coding Agent such as OpenCode + DeepSeek.

-------------------------------------------------------
Prompt:

Compare with SharePoint online, what are important features good to have or important for daily use? Update implementation plan version 1.2 accordingly.

=======================================================
-------------------------------------------------------
Implementation 
-------------------------------------------------------
Prompt:

I want to build an enterprise document management system for internal uses. Functionality and UI shall be similar to SharePoint Online, but only need key functions.

Tech stack:
- Frontend: React, Vite, strict TypeScript, React Router
- Design system: shadcn
- Styling: Tailwind CSS 4
- Backend: .NET 10, Entity Framework
- Authentication: Database authentication first, support SAML2 and OIDC in future
- Database is PostgreSQL

Function Spec and Technical Design Spec are in 'doc' folder.

Follow the Implementation Plan in 'doc' to start the implementation. 

PostgreSQL Login credential is in DEV-Credentials.md.

-------------------------------------------------------
Prompt:

I will go away for several hours. You just proceed to finish all milestones, Commit and git push each milestone before proceed.

-------------------------------------------------------
Prompt:

Entity framework can support different database. I still want the application able to support PostgreSQL. Suggest add application configuration of database type: PostgreSQL, SQL Database, MySQL or SQLite. For local DEV environment, the default database will be SQLite. 

Conduct full unit test and end-to-end test to make sure no error due to database change to SQLite.

--------------------------------------------------------
Prompt:

Current test coverage scope: backend code 40.8%, frendend ocde 6.5%. Need increase test coverage for both backend and frontend to above 90%.

Result:
Backend: 267 tests — Domain 107, Application 7, Integration 153 (all via dotnet test server/eDMS.sln)
Frontend: 123 Vitest tests across 24 files
E2E (Playwright): 7 tests — auth ×2, documents ×3, permissions ×1, versioning ×1

--------------------------------------------------------
Prompt:

New implementation plan is ready as 'doc\ImplementationPlan V1.1.md'

I will go away for several hours. You just proceed to finish all milestones in the implementation plan version V1.1, Commit and git push each milestone before proceed.

--------------------------------------------------------
Prompt:

I will go away for several hours. You just continue yesterday's work and proceed to finish all milestones in the implementation plan version V1.1, Commit and git push each milestone before proceed.

--------------------------------------------------------
Prompt:

Please fix the GitHub error.

========================================================
--------------------------------------------------------
GitHub
--------------------------------------------------------
Prompt:

Delete the following commit from Gitub history:
d64c4d324bc58dd7d2b12da51759dd2abb88b17c
cbc62d628d24ada6e4986864862827135d9febc9
d3026dfebd355813824804aa242f9cbc3998bbb6

Remove the commits from history but preserve the current final code by rewriting them into replacement commit(s).


========================================================
--------------------------------------------------------
Replacement MediatR
--------------------------------------------------------
Prompt:

Build Your Own CQRS Dispatcher in .NET 10 (No MediatR)
https://codewithmukesh.com/blog/cqrs-without-mediatr/

MediatR went commercial on July 2, 2025. If you have been running CQRS in ASP.NET Core for the last few years, your dispatcher just turned into a budget line item. In this article, I will build a custom CQRS dispatcher in .NET 10 that replaces MediatR with about 100 lines of code, supports the same pipeline behavior pattern, returns ValueTask<T> for fewer allocations, and benchmarks 4.4x faster than MediatR 12.4.1 on real BenchmarkDotNet runs. Let’s get into it.

Quick verdict. You do not need MediatR for CQRS. You also do not need to ship a 30-line reflection toy that ends up slower than MediatR. The right answer in .NET 10 is a FrozenDictionary<Type, RequestHandlerWrapper> dispatcher that builds typed wrappers once at startup and looks them up in O(1) at dispatch time. I benchmarked four approaches in this article and the FrozenDictionary version is 4.4x faster than MediatR 12.4.1, allocates 8.3x less memory per call, and works with Native AOT. The full runnable code, including BenchmarkDotNet results, lives in the GitHub repo.

https://github.com/codewithmukesh/dotnet-webapi-zero-to-hero-course/tree/main/modules/03-advanced-api-patterns/cqrs-without-mediatr

========================================================
--------------------------------------------------------
README.md
--------------------------------------------------------
Prompt:

Can make README.md looks more professional like other open source product? For example, have banner image for eDMS.
