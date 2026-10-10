# Architecture

CF Spoiler Shield is a Manifest V3 extension with no build step. `demo.html` loads the same classic scripts as the content script.

## Selection

`findArticle` prefers `[data-cfss-article]` and otherwise picks the largest `.ttypography` outside the comment area. Only that article is changed.

`collectBlocks` walks the article and emits coherent blocks:

- Headings `h1`–`h4`, and short paragraphs that look like `A. Title` or `1900A - Title`, start a suggested section. The heading stays visible.
- Paragraphs, lists, tables, figures, display equations, and native `.spoiler` elements stay intact. Nested paragraphs inside a spoiler are not separate reveals.
- A `pre`, a known code container, or a div whose only child is a `pre` is a code block. Inline `code` stays inside its paragraph.

Suggested sections are offered only after an explicit click. Manual selection marks a start block and an end block. Clicks outside the article are rejected. If a saved fingerprint no longer matches one unique slice under the same heading, the extension asks for a new selection and does not hide other content.

## Reveal state

Explanation blocks and code blocks are separate. `revealed` is how many explanation blocks are visible from the start of the section. `highWater` is the most explanations ever opened in that section, so hiding and reopening does not increase it. `codeRevealed` shows or hides every code block in the section at once. Native spoiler contents keep whatever display state the page gave them.

Shielding wraps each original node. Removing the shield puts those nodes back in order.

## Storage

The storage key is `cfss-state-v1`. The extension uses `chrome.storage.local`. The demo uses `localStorage`, or memory if that throws. Each saved record stores the normalized editorial URL (no hash or query), section id, heading anchor, structural fingerprint, reveal position, code visibility, high-water explanation count, and timestamp. The fingerprint stores tag, kind, and text-length bucket, not the editorial body.

On a reload in the same tab, `sessionStorage` can reapply a known shield while `chrome.storage.local` loads, so the page is not blanked and the wrong region is not hidden. A new tab may flash original text until storage returns. That is accidental-spoiler protection, not a defense against developer tools.

## Permissions

- `storage` saves progress and the auto-restore setting on this browser.
- `activeTab` lets the popup read the current tab’s URL when you open it, so it can tell an editorial from another site without a broad host permission.

Content scripts run only on `https://codeforces.com/blog/entry/*` and `https://*.codeforces.com/blog/entry/*`.
