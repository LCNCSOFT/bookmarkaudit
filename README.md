# Bookmark Audit

A Chrome extension that cross-references your bookmarks against your real
browsing history and recommends which to **keep**, **review**, or **retire**.

Everything runs locally. No data leaves your machine.

---

## Install (unpacked, for development)

1. Open Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select the `bookmark-audit` folder (the one containing `manifest.json`).
5. Click the puzzle-piece icon in the toolbar and pin **Bookmark Audit**.

Click the icon → **Run the audit**.

---

## How verdicts are decided

Each bookmark gets cross-referenced with `chrome.history.getVisits()` for its
exact URL. The scoring rules live in `dashboard.js` under `T` (thresholds)
and `score()` and are easy to tweak:

| Verdict     | Condition                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| **Keep**    | Last visit within 30 days                                                  |
| **Review**  | Last visit between 30–180 days ago, or never visited but added recently    |
| **Retire**  | Untouched for 6+ months, or saved 60+ days ago and never opened on record  |
| **New**     | Saved within the last 14 days and not yet visited                          |

### A caveat worth knowing

Chrome's history database typically retains around **90 days** of visits
(this depends on the user's settings and how heavily they browse). A
bookmark you've used regularly for years may show fewer visits than reality.
Treat the audit as a prompt for reflection, not a verdict from on high.

---

## File layout

```
bookmark-audit/
├── manifest.json       # MV3 manifest, permissions
├── popup.html / .css / .js   # toolbar popup
├── dashboard.html / .css / .js   # the full audit page
├── icons/              # 16/32/48/128 PNGs
└── README.md
```

## Permissions

| Permission   | Why                                                  |
| ------------ | ---------------------------------------------------- |
| `bookmarks`  | Read your bookmark tree, delete on request           |
| `history`    | Look up visit counts and last-visit times per URL    |
| `storage`    | (Reserved — for future settings persistence)         |
| `tabs`       | Open the dashboard in a new tab; open links from it  |

No `host_permissions`, no content scripts, no network requests.

---

## Tweaking the rules

Open `dashboard.js` and adjust the `T` object at the top:

```js
const T = {
  newGraceDays:        14,
  keepWithinDays:      30,
  keepMinVisits:        2,
  reviewWithinDays:   180,
  retireUnvisitedDays: 60,
};
```

Then reload the extension at `chrome://extensions` and re-run the audit.

---

## License

Personal use, modify freely. Fonts (Fraunces, JetBrains Mono) load from
Google Fonts via stylesheet link; both are SIL Open Font License 1.1.
