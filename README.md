# MD Browser

Un navigateur de documentation Markdown dans VS Code : on ouvre un fichier `.md`, on clique sur les liens pour passer d'un fichier à l'autre et on revient en arrière comme dans un navigateur web.

## Fonctions

- Rendu identique à l'aperçu Markdown de VS Code (même moteur, mêmes styles, thème clair ou sombre).
- Liens vers d'autres fichiers `.md`, avec ou sans ancre (`guide.md#installation`).
- Liens sans extension (`guide` → `guide.md`) et vers un dossier (→ `README.md` ou `index.md`).
- Chemins commençant par `/` : résolus depuis la racine du dossier de l'espace de travail.
- Liens externes ouverts dans le navigateur ; autres fichiers (code, PDF…) ouverts dans l'éditeur.
- Barre d'outils : précédent, suivant, accueil, recharger, historique, modifier.
- Position de défilement restaurée quand on revient sur une page.
- Rechargement automatique quand le fichier affiché est modifié.

## Ouvrir le navigateur

- Icône **MD Browser** dans la barre d'activités : arborescence de tous les fichiers Markdown du projet, un clic ouvre le fichier dans le navigateur.
- Clic droit sur un fichier `.md` dans l'explorateur → **Ouvrir dans MD Browser**.
- Icône de livre dans la barre de titre d'un fichier Markdown ouvert.
- Palette de commandes → **MD Browser: Ouvrir dans MD Browser** (propose une liste des `.md` du projet).

## Raccourcis (quand MD Browser a le focus)

| Action    | macOS              | Windows / Linux      |
|-----------|--------------------|----------------------|
| Précédent | ⌃- ou ⌘[           | Alt+← ou Ctrl+[      |
| Suivant   | ⌃⇧- ou ⌘]          | Alt+→ ou Ctrl+]      |

Les boutons précédent et suivant de la souris fonctionnent aussi.

## Installation

```bash
code --install-extension md-browser-0.1.0.vsix
```

Ou, dans VS Code : vue Extensions → menu « … » → **Install from VSIX…**

## Développement

```bash
npm install
npm run compile      # ou npm run watch
npm run package      # produit le .vsix
```

Pour déboguer, ouvrir le dossier dans VS Code et lancer F5 (Extension Development Host).
