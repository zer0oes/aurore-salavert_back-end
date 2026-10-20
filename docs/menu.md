# Textes du menu

Dans **Content Manager > Single Types > Menu**, renseigner puis publier les libellés pour chaque langue (FR et EN).

| Champ | Lien concerné |
| --- | --- |
| HomeLabel | Accueil |
| ShowcaseLabel | Creative Showcase |
| SkillsLabel | Compétences |
| ServicesLabel | Services personnalisés |
| ContactLabel | Contact |

Les libellés sont communs au mobile et au desktop. Leur modification ne change ni les titres des sections ni les ancres de navigation. Les champs vides utilisent les titres existants ; l’accueil utilise « Accueil » en français et « Home » en anglais.

Le menu publié est accessible en lecture via `/api/menu?locale=fr` ou `/api/menu?locale=en`. Seule l’action publique `find` est activée au démarrage. La modification et la publication restent réservées à l’administration Strapi.
