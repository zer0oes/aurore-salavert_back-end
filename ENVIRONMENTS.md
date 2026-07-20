# Environnements local et production

Les deux environnements sont volontairement isolés.

| | Local | Production |
|---|---|---|
| Front-end | `http://127.0.0.1:4200` | `https://www.aurore-salavert.fr` |
| API / admin Strapi | `http://127.0.0.1:1338` | `https://strapi.aurore-salavert.fr` |
| Base de données | `.tmp/data-local.db` (SQLite) | PostgreSQL via `DATABASE_URL` |
| Images et vidéos | `public/uploads` | S3 |

## Démarrer l'environnement local

Dans un premier terminal :

```powershell
npm.cmd run start:local
```

Dans le dépôt front-end :

```powershell
npm.cmd run start:local
```

Le back-end local force SQLite et le provider de médias local. Les identifiants PostgreSQL et S3 éventuellement présents dans `.env` ne sont pas utilisés pour écrire pendant ce lancement.

La commande suivante synchronise les contenus publics de production :

```powershell
npm.cmd run sync:production-content
```

Elle lit les catégories, layouts, projets, compétences, réseaux sociaux et médias de production, puis en crée des copies dans SQLite et `public/uploads`. Elle n'écrit jamais en production.

## Production

La production doit être lancée avec `NODE_ENV=production`. Cette valeur sélectionne PostgreSQL et S3. Ne pas utiliser les commandes locales pour un déploiement.
