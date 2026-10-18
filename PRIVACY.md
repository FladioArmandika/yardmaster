# Privacy

Yardmaster collects nothing.

- **No data leaves your browser.** There is no server, no analytics, no telemetry and no error reporting.
- **No tokens.** Yardmaster never asks for a GitHub token. It reads repository files and branch lists through github.com using the session you are already signed in with, exactly as the GitHub page itself does.
- **github.com only.** The extension only runs on `https://github.com/*`, and only does anything on a repository's Actions pages.
- **What it reads:** `.github/dispatch-ui.yml`, any options file that config names, and the repository's branch or tag names, all from the repository you are viewing. They stay in memory for about a minute and are never stored or sent anywhere.
- **What it stores:** only which sidebar folders you collapsed, per repository (for example `collapsed:owner/repo` → `["deploy"]`), in your browser's local extension storage. It never syncs or leaves your browser. Removing the extension deletes it.

The source code is public, so you can check all of this in this repository.
