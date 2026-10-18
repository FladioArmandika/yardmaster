# Yardmaster

**github.com only. No tokens, no backend, no telemetry. Open source.**

Yardmaster is a browser extension that upgrades GitHub Actions' "Run workflow" form:

- **Multiline inputs.** A `string` input becomes an auto-growing textarea, and newlines reach your workflow intact ([community#12882](https://github.com/orgs/community/discussions/12882)).
- **Computed dropdowns.** Options come from the repo's branches or tags, a JSON file in the repo, or a static list. Long lists are searchable ([community#11795](https://github.com/orgs/community/discussions/11795), [#12029](https://github.com/orgs/community/discussions/12029)).
- **Recent values.** Any plain text input suggests what you submitted before for that workflow, with no config. Stored only in your browser.
- **Workflow folders** in the Actions sidebar, grouped by filename prefix or a mapping, collapsible ([community#11831](https://github.com/orgs/community/discussions/11831)).

Your workflows keep declaring plain `string` inputs. Yardmaster only changes the form controls in your browser, so teammates without the extension still get GitHub's normal text field. If anything goes wrong, Yardmaster leaves GitHub's field untouched and shows a short note.

> Status: pre-release, not yet in the Chrome Web Store or Firefox Add-ons.

## Configure

Pick either option, or both. A config file entry for a workflow wins over markers.

### Option A: markers in the input description

```yaml
on:
  workflow_dispatch:
    inputs:
      notes:
        type: string
        description: "[multiline] Release notes"
      target:
        type: string
        description: "[options: branches] Branch to deploy"
      service:
        type: string
        description: "[options: file:.github/services.json] Service"
      size:
        type: string
        description: "[options: s, m, l] Size"
```

Yardmaster hides the markers from the label it shows.

### Option B: `.github/dispatch-ui.yml`

```yaml
version: 1
workflows:
  "*":                       # defaults for every workflow
    inputs:
      notes: { multiline: true }
  deploy.yml:
    inputs:
      notes:   { multiline: true, rows: 8 }
      ref:     { options: branches, match: "^release/" }
      tag:     { options: tags }
      service: { options: "file:.github/services.json" }
      region:  { options: [us-east-1, eu-west-1], allowCustom: true }
```

- `options` is `branches`, `tags`, `file:<path>`, a comma-separated string, or a YAML list. Each list item is text or `{ label, value }`.
- `match` filters options with a regular expression.
- `allowCustom: true` lets people type a value that isn't in the list. Without it, the form won't submit until a listed value is picked.
- An options file is a JSON array: `["api", "web"]` or `[{ "label": "API (prod)", "value": "api" }]`.
- Config and options files are read from the branch picked in "Use workflow from".

Order of precedence: the workflow's entry in `dispatch-ui.yml`, then description markers, then the `"*"` defaults.

For environments, use GitHub's built-in `type: environment` input, which already renders a dropdown.

### Recent values

Every single-line text input without other config remembers the last 10 values you submitted for that workflow and offers them when you click the field. You can still type anything.

Values are kept only in your browser's extension storage. Yardmaster never stores:

- inputs whose name looks like a credential (`token`, `secret`, `password`, `key`, `auth` and similar),
- multiline values, or values over 200 characters.

To turn it off for one input, set `recent: false` on it in `dispatch-ui.yml`. To turn it off for the whole repo, add `recent: false` at the top level.

### Sidebar folders

By default, workflows that share a filename prefix before `--` are grouped: `deploy--prod.yml` and `deploy--staging.yml` show under a "deploy" folder. A prefix needs at least two workflows to become a folder. Click a folder to collapse it; Yardmaster remembers that per repository in your browser. A collapsed folder still shows the workflow you're viewing.

To group differently, add `folders` to `.github/dispatch-ui.yml` on the default branch:

```yaml
folders:
  by: map              # prefix (default), map, or off
  map:
    Deploy: ["deploy-*.yml", "rollback.yml"]
    Checks: ["ci-*.yml"]
# or keep prefixes with another separator:
# folders: { by: prefix, separator: "_" }
```

This only changes how the sidebar looks. GitHub still requires workflow files to sit directly in `.github/workflows` ([community#18055](https://github.com/orgs/community/discussions/18055)).

### Good to know

- Newlines are sent as `\r\n`, which is how browsers submit multiline form fields. Strip `\r` in your workflow if it matters (for example `tr -d '\r'`).
- GitHub caps a dispatch payload at 65,535 characters. The textarea shows a counter as you get close.
- Press Cmd/Ctrl+Enter in a textarea to submit.

## How it works

- A content script runs on `https://github.com/*`, and only does anything on a repository's Actions pages.
- **Multiline:** a text input can't hold newlines, so the textarea takes over the input's `name` and GitHub's own submit sends it.
- **Dropdowns:** these are built on GitHub's own input, so whatever is in that field is what GitHub submits.
- **Data:** files and branch lists are read with same-origin requests using your existing github.com session. No GitHub API token is involved.
- **Selectors:** every GitHub DOM selector lives in [`src/github/selectors.ts`](src/github/selectors.ts), so a GitHub UI change is a small fix.

See [PRIVACY.md](PRIVACY.md).

## Develop

```sh
npm install
npm run dev            # Chrome with the extension loaded and hot reload
npm run dev:firefox
npm test               # unit tests (Vitest)
npm run build && npx playwright test --project fixtures   # extension against saved GitHub pages
npm run zip && npm run zip:firefox                        # store packages
```

## License

MIT
