# Privacy

Yardmaster collects nothing.

- **No data leaves your browser.** There is no server, no analytics, no telemetry and no error reporting.
- **No tokens.** Yardmaster never asks for a GitHub token. It reads repository files and branch lists through github.com using the session you are already signed in with, exactly as the GitHub page itself does.
- **github.com only.** The extension only runs on `https://github.com/*`, and only does anything on a repository's Actions pages.
- **What it reads:** `.github/dispatch-ui.yml`, any options file that config names, and the repository's branch or tag names, all from the repository you are viewing. They stay in memory for about a minute and are never stored or sent anywhere.
- **What it stores,** only in your browser's local extension storage, never synced or sent anywhere:
  - which sidebar folders you collapsed, per repository;
  - the last 10 values you submitted in each plain text input of a "Run workflow" form, per repository and workflow, so it can suggest them next time. Inputs whose names look like credentials (`token`, `secret`, `password`, `key`, `auth` and similar), multiline values and values over 200 characters are never stored. A repository can turn this off with `recent: false` in `.github/dispatch-ui.yml`.

  Removing the extension deletes all of it.

The source code is public, so you can check all of this in this repository.
