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

Netx, plan the next phase Implementation Plan and save as 'doc\ImplementationPlan V1.1.md'. Please note that the implementation will be done by other AI Coding Agent such as OpenCode + DeepSeek.

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

