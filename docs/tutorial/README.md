# Tutorial clips

Short silent demos (WebP + MP4) of real interactions, used in the READMEs.
Each `clips/<id>.mjs` exports `meta` / `seed` / `actions` / `verify` for the
make-kmind-tutorial-slice-lite pipeline: seeding goes through Still's kernel
RPC, every demonstrated action is real mouse/keyboard input, and `verify` reads
the stored data before a clip is accepted.

## Recording

1. Start the dev kernel in the clip's language and build the plugin:

   ```bash
   pnpm --filter @still/siyuan build
   STILL_LANG=zh-CN node apps/siyuan/scripts/serve.mjs     # or STILL_LANG=en
   ```

2. Use a working copy of the pipeline with a `still` host (base URL
   `http://127.0.0.1:6899`, waits for the `still` plugin), then per clip:

   ```bash
   node scripts/run-clip.mjs <repo>/docs/tutorial/clips/still-decide.mjs --locale zh-CN --out <dir>
   ```

3. Copy the `.webp` files into `docs/media/`.

Clips: `still-add-subscription`, `still-decide`, `still-snooze`,
`still-themes`, `still-calendar`, `still-slash`. Record clips one at a time:
they all reset the same workspace.
