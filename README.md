# CF Spoiler Shield

Read a Codeforces editorial one paragraph at a time. The extension hides the section you choose and reveals the original text only when you ask. It does not write hints, and it does not stop someone who opens developer tools.

## Quick start

1. Download and unzip the repository, or clone it.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click “Load unpacked” and select the folder containing `manifest.json`.
5. Open a Codeforces editorial (`codeforces.com/blog/entry/…`) and use the extension.

If that editorial tab was already open, refresh it. Chrome injects the content script on load, so a tab from before installation will not respond until you reload it.

No installs are required to use the extension or the demo.

To preview without installing the extension, double-click `demo.html`. It works from a `file://` address.

## Launch from the terminal

Clone the repository, then either load the folder in Chrome as above, or start Chrome with this extension from the command line. The commands below use a local Chrome profile so they still work if Chrome is already open.

### macOS

```bash
git clone https://github.com/seveneqq1/cf-spoiler-shield.git
cd cf-spoiler-shield
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$PWD/.chrome-profile" \
  --disable-extensions-except="$PWD" \
  --load-extension="$PWD"
```

Open the demo without Chrome:

```bash
open demo.html
```

### Windows

In PowerShell:

```powershell
git clone https://github.com/seveneqq1/cf-spoiler-shield.git
cd cf-spoiler-shield
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="$PWD\.chrome-profile" `
  --disable-extensions-except="$PWD" `
  --load-extension="$PWD"
```

Open the demo without Chrome:

```powershell
start demo.html
```

### Linux

```bash
git clone https://github.com/seveneqq1/cf-spoiler-shield.git
cd cf-spoiler-shield
google-chrome \
  --user-data-dir="$PWD/.chrome-profile" \
  --disable-extensions-except="$PWD" \
  --load-extension="$PWD"
```

If `google-chrome` is not on your PATH, use `google-chrome-stable` or `chromium`. Open the demo without Chrome:

```bash
xdg-open demo.html
```

After Chrome starts, open a Codeforces editorial (`codeforces.com/blog/entry/…`). If that tab was already open in this window, refresh it.

## How to read

1. Open the extension popup and choose **Choose editorial section**.
2. Pick a suggested problem heading, or click a start block and an end block and then **Shield selected section**.
3. Use **Reveal next paragraph**. Code stays behind **Hidden code** until you choose **Show code**.

The reader panel can be collapsed. When it is focused, the keys are:

| Key | Action |
| --- | --- |
| N | Reveal next paragraph |
| H | Hide last paragraph |
| C | Show or hide code |
| E | Reveal entire section |
| 0 | Reset progress |
| Esc | Collapse the panel |

Those keys do nothing while you are typing in a field. **Reveal entire section**, the first **Show code**, and **Reset progress** ask you to confirm. **Hide last paragraph** is saved. **Remove shield** puts the original section back.

Progress is stored in `chrome.storage.local` for the extension and in `localStorage` for the demo. Several sections of one editorial are remembered separately. If the editorial changes and a saved section cannot be matched, the page asks you to choose it again instead of hiding a different part.

## Popup

The popup explains the extension, starts section selection on an editorial, toggles automatic restore, lists recent sections, opens this demo, and clears saved progress after confirmation. On any other site it says the tab is unsupported. If the content script is missing, it tells you to refresh.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Saves reveal progress and the automatic-restore setting on this browser. |
| `activeTab` | Lets the popup see the current tab’s URL when you open it, so it can recognize an editorial without access to every website. |

Content scripts are limited to `https://codeforces.com/blog/entry/*` and `https://*.codeforces.com/blog/entry/*`. Nothing is sent off the device. There is no account, analytics, or remote code.

## Checks

Run the tests only if you want to. They are not required to load the extension.

```bash
node --test tests/
```

See `VERIFICATION.md` for the manual pass and `ARCHITECTURE.md` for selection, block grouping, and storage.

Screenshots from the demo: `docs/screenshots/shield-applied.png` and `docs/screenshots/progressive-reveal.png`.

## Privacy limit

Hidden blocks are removed from selection, keyboard focus, and accessibility names. The original nodes stay in the page so math, links, images, and lists still render when revealed. Anyone using developer tools can still read them.
