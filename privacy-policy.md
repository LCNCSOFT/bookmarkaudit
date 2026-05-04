# Bookmark Audit — Privacy Policy

**Last updated:** May 3, 2026

This privacy policy describes how the **Bookmark Audit** Chrome extension (the
"Extension") handles your data.

## Short version

Bookmark Audit reads your browser's bookmarks and browsing history *only on
your own computer* to generate a local audit report. **No personal data is
collected, transmitted, sold, or shared** with the developer or any third
party.

## What the Extension reads

To do its job, the Extension uses two Chrome APIs that read data already
stored in your local Chrome profile:

- **`chrome.bookmarks`** — reads the bookmark tree (titles, URLs, folder
  paths, dates added) so it can display your bookmarks in the audit, and
  deletes individual bookmarks when you explicitly click the **Delete**
  button.
- **`chrome.history`** — calls `chrome.history.getVisits()` once per
  bookmarked URL to count how many times you've visited it and when you
  last did. This is how verdicts (Keep / Review / Retire / New) are
  determined.

Both APIs return data that already exists in your local browser. **The
Extension does not transmit this data anywhere.**

The Extension also requests two non-sensitive permissions:

- **`tabs`** — used to open the audit dashboard in a new tab and to open
  bookmarked URLs you click on.
- **`storage`** — reserved for persisting user preferences in a future
  version. Not currently active.

## What the Extension does *not* do

- It does **not** read the contents of any web page (no content scripts,
  no host permissions).
- It does **not** track your browsing activity in real time.
- It does **not** have access to passwords, cookies, form data, or
  downloads.
- It contains **no analytics, no telemetry, no error reporting** of any
  kind.

## Network activity

The audit dashboard loads two open-source web fonts (Fraunces and
JetBrains Mono) from Google Fonts (`fonts.googleapis.com` and
`fonts.gstatic.com`). When the dashboard opens, your browser makes a
standard request to Google's font CDN. Google may log your IP address
and User-Agent as part of that request, as governed by
[Google's Privacy Policy](https://policies.google.com/privacy). **No
bookmark or history data is included** — these requests look identical
to any other web page that uses Google Fonts.

The Extension makes **no other network requests of any kind**. It does
not contact any server operated by the developer because no such server
exists.

## Data retention and deletion

All bookmark and history data viewed by the Extension stays in your
local Chrome profile and is governed by your Chrome settings (Chrome
typically retains around 90 days of history). Uninstalling the Extension
removes its code immediately; your bookmarks and history are unaffected.

## Permission justifications

| Permission   | Purpose                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `bookmarks`  | Read your bookmark tree to display it in the audit; delete bookmarks you explicitly remove.       |
| `history`    | Call `chrome.history.getVisits(url)` per bookmark to compute visit counts and last-visit times.   |
| `tabs`       | Open the audit dashboard in a new tab and open bookmarked URLs you click.                         |
| `storage`    | Reserved for future user-preference persistence. Not currently active.                            |

## Changes to this policy

If this policy ever changes, the new version will be posted at this URL
with an updated "Last updated" date.

## Contact

Questions or concerns: **[your-email@example.com]** *(replace before
publishing)* — or open an issue at **[your repository URL]**.
