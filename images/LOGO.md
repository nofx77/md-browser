# Logo — concept 1 (fenêtre de navigateur)

| Fichier | Usage |
|---|---|
| `images/icon.png` (128 × 128) | Icône de l'extension dans le Marketplace (`"icon"` du package.json) |
| `images/icon@2x.png` (256 × 256), `images/icon-512.png` | Versions haute résolution (README, GitHub, réseaux) |
| `images/icon.svg` | Source vectorielle (ne pas utiliser comme `"icon"` : le Marketplace refuse les SVG) |
| `images/activitybar.svg` | Icône monochrome 24 × 24 pour la barre d'activités (suit la couleur du thème) |

## package.json

```json
{
  "icon": "images/icon.png",
  "galleryBanner": { "color": "#0F172A", "theme": "dark" },
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        { "id": "mdBrowser", "title": "Markdown Browser", "icon": "images/activitybar.svg" }
      ]
    }
  }
}
```

Couleurs : fond `#0F172A`, fenêtre `#1E293B`, accent `#38BDF8`, flèches `#F59E0B`, M `#FFFFFF`.
