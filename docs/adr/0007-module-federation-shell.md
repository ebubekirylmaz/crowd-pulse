# 0007: Compose the app with Module Federation, three apps and a shared UI package

Status: accepted

## Context

The Q&A screens and the analytics dashboard are different products with different change rates: the dashboard is read-mostly and heavy on charts, the Q&A screens are realtime and used on phones. They started in one Vite app, which meant one build, one deploy and one failure domain. The goal is to deploy and break them independently while the user still sees one product with one login.

## Decision

- Three apps: **`apps/shell`** (host: router, header for the analytics page, host token check), **`apps/qa`** (remote exposing `./Routes`) and **`apps/analytics`** (remote exposing `./Dashboard`). Built with `@module-federation/vite`.
- The shell does not import code from the remotes at build time. It knows their names and finds them through `REMOTE_QA_URL` and `REMOTE_ANALYTICS_URL`, so a new analytics build can go live without rebuilding the shell.
- **`packages/ui`** holds the components, icons and Tailwind theme (including the brand colors). All three apps consume it as a workspace package, so the look cannot drift. The package is compiled by each consumer, so there is no separate build step for it.
- **React, React DOM and React Router are shared singletons.** Router context must be the same instance everywhere, otherwise a `Link` rendered by one module would not navigate inside the shell.
- **Auth is a contract, not shared code**: the host token lives under one storage key and the shell passes it to the analytics module as a prop, along with `onUnauthorized` and `onSelectRoom` callbacks. The dashboard knows nothing about routing or storage.
- Each remote renders inside an **error boundary**. If a remote cannot be fetched, the shell shows an "unavailable" card with a button that reloads the page, and the rest of the app keeps working.
- The remotes still run standalone, which keeps local development and their own tests simple.

## Consequences

- Verified locally with all three dev servers: navigating from a Q&A page to analytics is a client-side transition; stopping the analytics server leaves the shell and the Q&A pages working and shows the fallback; starting it again and reloading recovers.
- Each Vercel project has `npx turbo-ignore @crowd-pulse/<app>` as its Ignored Build Step. It asks Turborepo whether the app or any workspace package it depends on changed since the last deployment, and skips the build if not. A change to `packages/ui` rebuilds all three, a change to the analytics dashboard rebuilds only analytics. Changing an environment variable does not trigger a build by itself, so the shell needs a manual redeploy when a remote address changes.
- A retry cannot re-import a failed remote without a reload, because the federation runtime remembers the failed load. The button therefore reloads the page.
- Shared singletons couple the three apps to compatible React and React Router majors. Version ranges are declared in each config, and a mismatch shows up as a runtime warning instead of a build error.
- Each module's CSS is bundled with it, so shared styles are downloaded once per module. The cost is small for this size and avoids a global stylesheet owned by the shell.
- Remote types are declared by hand in the shell (`remotes.d.ts`) because the generated type download was not reliable. A contract change needs both sides updated.

## Alternatives considered

- **One app with route-based code splitting**: simplest and fastest, but one deploy and one failure domain, which is exactly what this change set out to avoid.
- **Iframes**: strong isolation, but no shared router, awkward auth and theming, and poor mobile behavior.
- **Web components or single-spa**: workable, but more glue for sharing React and routing than Module Federation needs here.
- **Publishing the UI kit as an npm package**: needed with separate repositories, an unnecessary release step inside one monorepo.
