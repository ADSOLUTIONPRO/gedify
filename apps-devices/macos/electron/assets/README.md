# Assets macOS

Déposer ici les visuels de marque Gedify :

- `gedify-icon.png` — icône (dossier Gedify seul), carrée ≥ 512 px
- `gedify-logo.png` — logo complet
- `Gedify.icns` — **généré** depuis le PNG par `npm run make:icns` (ne pas committer, voir `.gitignore`)

Génération de l'icône macOS :

```bash
npm run make:icns                       # utilise public/gedify-icon.png du projet web
# ou
bash scripts/make-icns.sh /chemin/vers/icone.png
```

Les sources de marque vivent dans le projet web (`public/gedify-icon.png`, `public/gedify-logo.png`)
et sont réutilisées ici — pas de duplication d'identité.
