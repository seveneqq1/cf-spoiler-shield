# Manual verification

Automated checks cover block grouping, reveal and hide, separate code visibility, independent section progress, fingerprint matching, and unshielding. Use this list for the browser.

## Demo (no install)

1. Double-click `demo.html`.
2. Choose **A. Lantern Count**. Confirm the heading stays visible and the body is replaced by placeholders with no excerpts.
3. Choose **Reveal next paragraph** until the list and equation appear as whole blocks. Confirm the program stays on **Hidden code**.
4. Open **Show code**, confirm the dialog, and check that only the code appears.
5. Choose **Hide last paragraph**, reload, and confirm the same paragraph is hidden again.
6. Shield **B. Ferry Schedule** as well. Reveal one paragraph there, switch sections in the panel, and confirm A did not move.
7. Reveal B’s spoiler block and confirm **Worked example** is still collapsed until its title is clicked.
8. Remove the shield and confirm the original paragraphs, figure, and code are back.
9. Change nothing, reload, and confirm a removed shield stays off.
10. Manually select **Implementation notes** through its code block. Suggested sections should not have included that label as its own problem.

## Extension

1. Load the repository folder from `chrome://extensions` after enabling Developer mode.
2. Refresh any Codeforces editorial that was already open.
3. Open the popup. On a non-editorial tab it should explain that the tab is unsupported.
4. On an editorial, choose a suggested section or mark a start and end block.
5. Reveal a paragraph, hide it, reload, and confirm progress returns when automatic restore is on.
6. Turn automatic restore off, reload, and confirm the editorial is fully visible.
7. Clear saved progress from the popup and confirm the list is empty.

## Limits

A saved section is restored only when its heading and block fingerprint still match. Developer tools can still read the hidden DOM. The extension does not run on every Codeforces page, only blog entries.
