# Still · 续了么

Subscription tracker that asks before it renews. SiYuan plugin first; Obsidian,
self-hosted server (Docker) and mobile clients later.

## Layout

```
packages/core     Platform-independent domain logic (no DOM, no Intl, no crypto):
                  calendar dates, billing cycles, money, HLC timestamps,
                  reminders, file-per-record repository. Runs in goja.
packages/ui       React + shadcn/ui views shared by every host. Tailwind classes
                  are prefixed `still:`; no global preflight; theme via tokens.
apps/siyuan       SiYuan plugin: kernel.js (goja, owns data + scheduling) and
                  index.js (frontend: dock, tab, status bar, reminder card).
tools/goja-runner Runs JS in the same goja setup SiYuan uses, for tests.
```

## Commands

```bash
pnpm install
pnpm test        # core unit tests + kernel.js end-to-end in real goja (needs Go)
pnpm typecheck
pnpm build       # apps/siyuan/dist + apps/siyuan/package.zip
```

Develop against a SiYuan workspace (3.8.5+, with bazaar plugins trusted):

```bash
pnpm --filter @still/siyuan dev
node apps/siyuan/scripts/link.mjs ~/SiYuan/<workspace>
```

## Design notes

- **The kernel plugin is the single writer.** The frontend calls it over
  JSON-RPC (`apps/siyuan/src/shared/rpc.ts`); it broadcasts `changed` and
  `reminders-due`. Reminders are computed even when no window is open.
- **One file per subscription** under `data/storage/petal/still/subscriptions/`,
  so SiYuan's file-level sync behaves like per-record last-writer-wins.
  Deletes are tombstones. `updatedAt` is a hybrid logical clock string, ready
  for a sync server.
- **Dates are civil dates** (`YYYY-MM-DD`), never instants. Month cycles are
  computed from the anchor (Jan 31 → Feb 28 → Mar 31). The kernel uses the
  host time zone; Docker deployments should set `TZ`.
- **Reminders** collapse missed thresholds into the most urgent one, wait for
  `notifyAt` on the day, and are claimed atomically so only one window shows
  each one. Delivery logs are per device (`delivered/<deviceId>.json`).
