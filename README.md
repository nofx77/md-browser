# MD Browser

A Markdown documentation browser for VS Code: open a `.md` file, click links to move from one file to another, and go back just like in a web browser.

## Features

- Rendering identical to the VS Code Markdown preview (same engine, same styles, light or dark theme).
- Links to other `.md` files, with or without an anchor (`guide.md#installation`).
- Links without an extension (`guide` → `guide.md`) and to a folder (→ `README.md` or `index.md`).
- Paths starting with `/` are resolved from the workspace folder root.
- External links open in the browser; other files (code, PDF…) open in the editor.
- Toolbar: back, forward, home, reload, history, edit.
- Scroll position restored when you return to a page.
- Automatic reload when the displayed file changes.

## Opening the browser

- **MD Browser** icon in the activity bar: tree of every Markdown file in the project; one click opens the file in the browser.
- Right-click a `.md` file in the Explorer → **Ouvrir dans MD Browser**.
- Book icon in the title bar of an open Markdown file.
- Command Palette → **MD Browser: Ouvrir dans MD Browser** (offers a list of the project's `.md` files).

## Shortcuts (when MD Browser has focus)

| Action  | macOS        | Windows / Linux  |
|---------|--------------|------------------|
| Back    | ⌃- or ⌘[     | Alt+← or Ctrl+[  |
| Forward | ⌃⇧- or ⌘]    | Alt+→ or Ctrl+]  |

The mouse back and forward buttons work too.

## Installation

```bash
code --install-extension md-browser-0.1.0.vsix
```

Or, in VS Code: Extensions view → "…" menu → **Install from VSIX…**

## Development

```bash
npm install
npm run compile      # or npm run watch
npm run package      # builds the .vsix
```

To debug, open the folder in VS Code and press F5 (Extension Development Host).
