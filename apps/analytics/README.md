# Analytics module

The analytics dashboard, built as a Module Federation remote. It exposes one component, `./Dashboard`, which takes a host token and a few callbacks. The shell loads it at runtime from `remoteEntry.js`.

```bash
npm run dev -w @crowd-pulse/analytics
```

The dev server runs on `http://localhost:5174`. Opened on its own, it renders the dashboard with the host token found in local storage, which is handy for working on the chart without the shell.

The design reasons are in [ADR 0007](../../docs/adr/0007-module-federation-shell.md).
