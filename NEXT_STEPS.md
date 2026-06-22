# Next steps

## PDF support

Goal: bring PDF translation into the GitHub Pages version without adding a
backend dependency.

Possible approaches:

1. Client-side text extraction for PDFs that contain selectable text.
2. Optional file upload to a separate API only if we decide the static version
   cannot cover the full flow.
3. Keep the current text translator stable first, then add PDF behind a clear UI
   branch.

## Decision point

If we want full parity with the original app, PDF handling will likely need a
server-side component. If the goal is a clean GitHub demo, text translation
should ship first and PDF can come next.
