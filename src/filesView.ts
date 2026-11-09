import * as vscode from 'vscode';

type Node = FolderNode | FileNode;

interface FolderNode {
  kind: 'folder';
  name: string;
  key: string;
  children: Map<string, Node>;
}

interface FileNode {
  kind: 'file';
  name: string;
  uri: vscode.Uri;
}

/** Arborescence des fichiers Markdown de l'espace de travail (vue de la barre d'activités). */
export class MarkdownFilesProvider implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private root: FolderNode | undefined;
  private refreshTimer: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,markdown}', false, true, false);
    watcher.onDidCreate(() => this.scheduleRefresh());
    watcher.onDidDelete(() => this.scheduleRefresh());
    context.subscriptions.push(
      watcher,
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );
  }

  refresh() {
    this.root = undefined;
    this.emitter.fire(undefined);
  }

  private scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => this.refresh(), 500);
  }

  async getChildren(element?: Node): Promise<Node[]> {
    if (!element) {
      this.root ??= await this.buildTree();
      return sortNodes([...this.root.children.values()]);
    }
    return element.kind === 'folder' ? sortNodes([...element.children.values()]) : [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'folder') {
      const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = vscode.ThemeIcon.Folder;
      item.id = node.key;
      return item;
    }
    const item = new vscode.TreeItem(node.uri, vscode.TreeItemCollapsibleState.None);
    item.label = node.name;
    item.contextValue = 'mdFile';
    item.tooltip = vscode.workspace.asRelativePath(node.uri);
    item.command = { command: 'mdBrowser.open', title: 'Ouvrir dans MD Browser', arguments: [node.uri] };
    return item;
  }

  private async buildTree(): Promise<FolderNode> {
    const root: FolderNode = { kind: 'folder', name: '', key: '', children: new Map() };
    const files = await vscode.workspace.findFiles('**/*.{md,markdown}', '**/{node_modules,vendor,.git}/**', 5000);
    const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;

    for (const uri of files) {
      const rel = vscode.workspace.asRelativePath(uri, multiRoot);
      const parts = rel.split(/[\\/]/);
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts.slice(0, i + 1).join('/');
        let child = current.children.get(parts[i]);
        if (!child || child.kind !== 'folder') {
          child = { kind: 'folder', name: parts[i], key, children: new Map() };
          current.children.set(parts[i], child);
        }
        current = child;
      }
      const name = parts[parts.length - 1];
      current.children.set(name, { kind: 'file', name, uri });
    }
    return root;
  }
}

/** Dossiers d'abord, puis README en tête, puis ordre alphabétique. */
function sortNodes(nodes: Node[]): Node[] {
  const rank = (n: Node) => (n.kind === 'folder' ? 0 : /^readme\./i.test(n.name) ? 1 : 2);
  return nodes.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}
