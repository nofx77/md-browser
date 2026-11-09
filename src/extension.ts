import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownFilesProvider } from './filesView';

const MARKDOWN_EXTS = ['.md', '.markdown', '.mdown', '.mkd'];
const INDEX_FILES = ['README.md', 'readme.md', 'index.md', 'INDEX.md'];

interface HistoryEntry {
  uri: vscode.Uri;
  fragment?: string;
  scrollY: number;
}

export function activate(context: vscode.ExtensionContext) {
  const filesProvider = new MarkdownFilesProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('mdBrowser.files', filesProvider),
    vscode.commands.registerCommand('mdBrowser.refreshFiles', () => filesProvider.refresh()),
    vscode.commands.registerCommand('mdBrowser.open', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri ?? (await pickMarkdownFile());
      if (!target) {
        return;
      }
      MdBrowserPanel.show(context, target);
    }),
    vscode.commands.registerCommand('mdBrowser.back', () => MdBrowserPanel.current?.back()),
    vscode.commands.registerCommand('mdBrowser.forward', () => MdBrowserPanel.current?.forward())
  );
}

export function deactivate() {}

async function pickMarkdownFile(): Promise<vscode.Uri | undefined> {
  const files = await vscode.workspace.findFiles('**/*.{md,markdown}', '**/node_modules/**', 2000);
  if (files.length === 0) {
    vscode.window.showInformationMessage('Aucun fichier Markdown trouvé dans l’espace de travail.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    files
      .map((f) => ({ label: path.basename(f.fsPath), description: vscode.workspace.asRelativePath(f), uri: f }))
      .sort((a, b) => a.description.localeCompare(b.description)),
    { placeHolder: 'Choisir un fichier Markdown à ouvrir dans MD Browser' }
  );
  return picked?.uri;
}

class MdBrowserPanel {
  static current: MdBrowserPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private backStack: HistoryEntry[] = [];
  private forwardStack: HistoryEntry[] = [];
  private currentEntry: HistoryEntry | undefined;
  private homeUri: vscode.Uri | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;
  private reloadTimer: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, uri: vscode.Uri) {
    if (MdBrowserPanel.current) {
      MdBrowserPanel.current.panel.reveal(undefined, false);
      MdBrowserPanel.current.navigate(uri, undefined, true);
      return;
    }
    MdBrowserPanel.current = new MdBrowserPanel(context, uri);
  }

  private constructor(private readonly context: vscode.ExtensionContext, uri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel('mdBrowser', 'MD Browser', vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: this.resourceRoots(uri),
    });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(context.extensionUri, 'images', 'tab-light.svg'),
      dark: vscode.Uri.joinPath(context.extensionUri, 'images', 'tab-dark.svg'),
    };
    this.homeUri = uri;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), null, this.disposables);

    this.navigate(uri, undefined, true);
  }

  // ---------- Navigation ----------

  async navigate(uri: vscode.Uri, fragment: string | undefined, pushHistory: boolean) {
    if (pushHistory && this.currentEntry) {
      // Lien vers une ancre du même fichier : on défile sans re-rendre.
      if (this.currentEntry.uri.toString() === uri.toString() && fragment) {
        this.backStack.push({ ...this.currentEntry });
        this.forwardStack = [];
        this.currentEntry = { uri, fragment, scrollY: 0 };
        this.panel.webview.postMessage({ type: 'scrollToFragment', fragment });
        this.postNavState();
        return;
      }
      this.backStack.push({ ...this.currentEntry });
      this.forwardStack = [];
    }
    await this.load({ uri, fragment, scrollY: 0 });
  }

  back() {
    const prev = this.backStack.pop();
    if (!prev || !this.currentEntry) {
      return;
    }
    this.forwardStack.push({ ...this.currentEntry });
    this.load(prev);
  }

  forward() {
    const next = this.forwardStack.pop();
    if (!next || !this.currentEntry) {
      return;
    }
    this.backStack.push({ ...this.currentEntry });
    this.load(next);
  }

  private async load(entry: HistoryEntry, keepScroll = false) {
    let text: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(entry.uri);
      text = new TextDecoder('utf-8').decode(bytes);
    } catch {
      vscode.window.showErrorMessage(`MD Browser : impossible de lire ${entry.uri.fsPath}`);
      return;
    }

    const isSameFile = this.currentEntry?.uri.toString() === entry.uri.toString();
    this.currentEntry = entry;
    this.panel.title = path.basename(entry.uri.fsPath);
    this.panel.webview.options = { enableScripts: true, localResourceRoots: this.resourceRoots(entry.uri) };

    const body = (await vscode.commands.executeCommand<string>('markdown.api.render', text)) ?? '';
    this.panel.webview.html = this.buildHtml(entry, body, keepScroll);

    if (!isSameFile || !this.watcher) {
      this.watchFile(entry.uri);
    }
  }

  private watchFile(uri: vscode.Uri) {
    this.watcher?.dispose();
    const dir = vscode.Uri.joinPath(uri, '..');
    this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, path.basename(uri.fsPath)));
    const reload = () => {
      if (this.reloadTimer) {
        clearTimeout(this.reloadTimer);
      }
      this.reloadTimer = setTimeout(() => {
        if (this.currentEntry) {
          this.load({ ...this.currentEntry, fragment: undefined }, true);
        }
      }, 200);
    };
    this.watcher.onDidChange(reload);
    this.watcher.onDidCreate(reload);
  }

  // ---------- Messages de la Webview ----------

  private async onMessage(msg: any) {
    switch (msg.type) {
      case 'link':
        await this.followLink(String(msg.href ?? ''));
        break;
      case 'back':
        this.back();
        break;
      case 'forward':
        this.forward();
        break;
      case 'home':
        if (this.homeUri) {
          this.navigate(this.homeUri, undefined, true);
        }
        break;
      case 'reload':
        if (this.currentEntry) {
          this.load(this.currentEntry, true);
        }
        break;
      case 'edit':
        if (this.currentEntry) {
          vscode.window.showTextDocument(this.currentEntry.uri, { viewColumn: vscode.ViewColumn.Beside });
        }
        break;
      case 'scroll':
        if (this.currentEntry && typeof msg.scrollY === 'number') {
          this.currentEntry.scrollY = msg.scrollY;
        }
        break;
      case 'history': {
        // Saut direct à une entrée de l'historique (menu déroulant).
        const idx = Number(msg.index);
        if (Number.isInteger(idx) && idx >= 0 && idx < this.backStack.length && this.currentEntry) {
          const removed = this.backStack.splice(idx);
          const target = removed.shift()!;
          this.forwardStack.push({ ...this.currentEntry }, ...removed.reverse());
          this.load(target);
        }
        break;
      }
    }
  }

  private async followLink(rawHref: string) {
    if (!rawHref || !this.currentEntry) {
      return;
    }

    // Ancre dans le fichier courant
    if (rawHref.startsWith('#')) {
      this.navigate(this.currentEntry.uri, decodeURIComponent(rawHref.slice(1)), true);
      return;
    }

    // Liens externes
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawHref) && !/^file:/i.test(rawHref)) {
      vscode.env.openExternal(vscode.Uri.parse(rawHref));
      return;
    }

    const [hrefPath, ...fragParts] = rawHref.split('#');
    const fragment = fragParts.length ? decodeURIComponent(fragParts.join('#')) : undefined;
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(hrefPath.split('?')[0]);
    } catch {
      decodedPath = hrefPath;
    }

    let target: vscode.Uri;
    if (/^file:/i.test(decodedPath)) {
      target = vscode.Uri.parse(decodedPath);
    } else if (decodedPath.startsWith('/')) {
      // Chemin absolu : relatif à la racine du dossier de l'espace de travail
      const folder = vscode.workspace.getWorkspaceFolder(this.currentEntry.uri);
      target = folder
        ? vscode.Uri.joinPath(folder.uri, decodedPath)
        : this.currentEntry.uri.with({ path: decodedPath });
    } else {
      target = vscode.Uri.joinPath(this.currentEntry.uri, '..', decodedPath);
    }

    const resolved = await this.resolveTarget(target);
    if (!resolved) {
      vscode.window.showWarningMessage(`MD Browser : lien introuvable « ${rawHref} »`);
      return;
    }

    if (isMarkdown(resolved)) {
      this.navigate(resolved, fragment, true);
    } else {
      vscode.commands.executeCommand('vscode.open', resolved, { viewColumn: vscode.ViewColumn.Beside });
    }
  }

  /** Gère les fichiers, les liens sans extension (« guide » → guide.md) et les dossiers (→ README.md). */
  private async resolveTarget(uri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const stat = await statSafe(uri);
    if (stat?.type === vscode.FileType.File) {
      return uri;
    }
    if (stat?.type === vscode.FileType.Directory) {
      for (const name of INDEX_FILES) {
        const candidate = vscode.Uri.joinPath(uri, name);
        if ((await statSafe(candidate))?.type === vscode.FileType.File) {
          return candidate;
        }
      }
      return undefined;
    }
    if (!path.extname(uri.path)) {
      const candidate = uri.with({ path: uri.path + '.md' });
      if ((await statSafe(candidate))?.type === vscode.FileType.File) {
        return candidate;
      }
    }
    return undefined;
  }

  private postNavState() {
    this.panel.webview.postMessage({
      type: 'navState',
      canBack: this.backStack.length > 0,
      canForward: this.forwardStack.length > 0,
      history: this.historyLabels(),
    });
  }

  private historyLabels() {
    return this.backStack.map((e, i) => ({
      index: i,
      label: vscode.workspace.asRelativePath(e.uri) + (e.fragment ? `#${e.fragment}` : ''),
    }));
  }

  // ---------- HTML ----------

  private resourceRoots(uri: vscode.Uri): vscode.Uri[] {
    const roots = [this.context.extensionUri, vscode.Uri.joinPath(uri, '..')];
    for (const f of vscode.workspace.workspaceFolders ?? []) {
      roots.push(f.uri);
    }
    const mdExt = vscode.extensions.getExtension('vscode.markdown-language-features');
    if (mdExt) {
      roots.push(mdExt.extensionUri);
    }
    return roots;
  }

  private buildHtml(entry: HistoryEntry, body: string, keepScroll: boolean): string {
    const webview = this.panel.webview;
    const nonce = makeNonce();
    const baseHref = webview.asWebviewUri(vscode.Uri.joinPath(entry.uri, '..')).toString() + '/';
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'browser.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'browser.js'));

    // Styles de l'aperçu Markdown natif de VS Code, pour un rendu identique
    const mdExt = vscode.extensions.getExtension('vscode.markdown-language-features');
    const nativeStyles = mdExt
      ? ['markdown.css', 'highlight.css']
          .map((f) => `<link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(mdExt.extensionUri, 'media', f))}">`)
          .join('\n')
      : '';

    const relPath = vscode.workspace.asRelativePath(entry.uri);
    const state = {
      canBack: this.backStack.length > 0,
      canForward: this.forwardStack.length > 0,
      fragment: entry.fragment ?? null,
      scrollY: keepScroll || entry.scrollY ? entry.scrollY : 0,
      history: this.historyLabels(),
    };

    return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="${baseHref}">
${nativeStyles}
<link rel="stylesheet" href="${styleUri}">
<title>${escapeHtml(relPath)}</title>
</head>
<body>
<nav class="mdb-toolbar">
  <button id="mdb-back" title="Précédent (Alt+← / ⌃-)" aria-label="Précédent">←</button>
  <button id="mdb-forward" title="Suivant (Alt+→ / ⌃⇧-)" aria-label="Suivant">→</button>
  <button id="mdb-home" title="Retour au fichier de départ" aria-label="Accueil">⌂</button>
  <button id="mdb-reload" title="Recharger" aria-label="Recharger">⟳</button>
  <span class="mdb-path" title="${escapeHtml(entry.uri.fsPath)}">${escapeHtml(relPath)}</span>
  <select id="mdb-history" title="Historique" aria-label="Historique"></select>
  <button id="mdb-edit" title="Ouvrir le fichier source à côté" aria-label="Modifier">✎ Modifier</button>
</nav>
<main class="markdown-body mdb-content">
${body}
</main>
<script nonce="${nonce}">window.__MDB_STATE__ = ${JSON.stringify(state).replace(/</g, '\\u003c')};</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose() {
    MdBrowserPanel.current = undefined;
    this.watcher?.dispose();
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}

function isMarkdown(uri: vscode.Uri) {
  return MARKDOWN_EXTS.includes(path.extname(uri.path).toLowerCase());
}

async function statSafe(uri: vscode.Uri) {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
}

function makeNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
