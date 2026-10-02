# Frontend product audit notes

Warka has extensive backend and domain coverage across school operations,
academic workflows, portals, reporting, documents, governance, and operations.
The current frontend exposes much of that capability, but its presentation
still needs productization.

The organization-owner workspace renders too many independent tools in one
long document. Anchor navigation and stacked feature forms do not give users a
clear dashboard, task hierarchy, or stable sense of location. Authentication
also combines sign-in, recovery request, recovery token, and new-password
controls on one screen; these should become separate routes and focused flows.

Before applying visual polish to individual screens, establish:

1. Role-based information architecture and routed workspaces.
2. A responsive application shell with organization and school context.
3. Design tokens and reusable form, button, card, table, status, dialog, and
   feedback primitives.
4. Standard loading, empty, error, success, and permission states.
5. Representative synthetic data for each role at desktop and mobile sizes.

This note describes frontend product quality. It does not assess backend or
domain completeness and does not prescribe authorization changes.
