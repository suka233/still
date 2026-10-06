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

The dock clips open it with real input after the capture timeline starts, so
the first-open animation is included. Decision clips then open the pending
charge from the dock, keep a full view of the card and dock during feedback,
and wait for the stamp, exit and list update before resting in empty space.
Host hover tooltips are hidden during capture. The theme clip verifies every
stop (Boutique → Ticket → Riso → Swiss → Thermal), then Thermal in dark mode.

Current durations: add 12.8s, decide 10.0s, snooze 12.2s, themes 16.8s,
calendar 11.6s, slash 8.8s. In addition to each six-frame contact sheet, inspect
frames around the decision click at +0.2s, +0.6s, +0.8s and +1.0s to see the
short feedback that evenly spaced samples can miss.

The latest checks, actual WebP durations, sizes and hashes are retained in
[recording-results.json](recording-results.json). Recording work files and MP4s
are removed after visual QA. `syncDriftS` measures the wall-clock estimate
against the video's startup offset; the slice itself is aligned by its magenta
frame marker. Check short feedback against the captured pointer-event times.
The sweep's startup-drift warnings are retained in the results, with the frame
alignment review. All deliverable format checks and semantic verification
remain required.

## Store preview

With a Chinese dev kernel running on a **disposable** workspace:

```bash
node docs/tutorial/preview.mjs
```

This resets Still to `seed.mjs` demo data, captures the light Thermal dock and
decision card with transparent backgrounds, and composes the 1024×768 image.
It writes identical copies to `docs/media/preview.png` and
`apps/siyuan/preview.png`. It uses Playwright from `tools/snap` and the installed
Chrome. `STILL_PORT` can override the dev port.

After recording, stop only the dev kernel you started. Back up
`~/.config/siyuan/workspace.json`, remove only your temporary workspace entries,
and delete those workspaces (including `temp/install`) plus recording work files.

Clips: `still-add-subscription`, `still-decide`, `still-snooze`,
`still-themes`, `still-calendar`, `still-slash`. Record clips one at a time:
they all reset the same workspace.
