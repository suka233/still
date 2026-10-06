# Tutorial clips

Short silent demos (WebP + MP4) of real interactions, used in the READMEs.
Each `clips/<id>.mjs` exports `meta` / `seed` / `actions` / `verify` for the
make-kmind-tutorial-slice-lite pipeline: seeding goes through Still's kernel
RPC, every demonstrated action is real mouse/keyboard input, and `verify` reads
the stored data before a clip is accepted.

## Recording

1. Build the plugin and start a dev kernel in the clip's language. Give it a
   workspace of its own if the SiYuan app is open on `~/SiYuan/still-dev`
   (a workspace can only be used by one kernel):

   ```bash
   pnpm --filter @still/siyuan build
   STILL_LANG=zh-CN node apps/siyuan/scripts/serve.mjs [workspace]     # or STILL_LANG=en
   ```

   The kernel adds the workspace to `~/.config/siyuan/workspace.json` and may
   download an update into `<workspace>/temp/install`; remove both afterwards.

2. Make a working copy of the pipeline with the `still` host
   ([still-host.mjs](still-host.mjs); it uses the installed Chrome when
   Playwright's browser isn't downloaded), then record per clip and locale:

   ```bash
   repo=$PWD rec=$(docs/tutorial/setup-recorder.sh)
   (cd "$rec" && node scripts/run-clip.mjs "$repo/docs/tutorial/clips/still-decide.mjs" --locale zh-CN --out /tmp/still-clips/still-decide)
   ```

   A clip is only encoded when its `verify` passes. Check frames with
   `node scripts/contact-sheet.mjs <clip>.mp4 --frames 6` in the same copy.

3. Copy the `.webp` files into `docs/media/`.

Clips: `still-add-subscription`, `still-decide`, `still-snooze`,
`still-themes`, `still-calendar`, `still-slash`. Record clips one at a time:
they all reset the same workspace.
