# Aurore Salavert — Back-end

API et interface d'administration [Strapi](https://docs.strapi.io/), en version 5.

## Prérequis

- Node.js 24.x (version cible du projet, voir `engines` dans `package.json`)
- npm 10 ou plus récent

> Sous Windows, `better-sqlite3` n'a pas encore de binaire précompilé pour Node 24 : le compiler depuis les sources nécessite Visual Studio Build Tools ("Desktop development with C++"). À défaut, une version Node 20 ou 22 (LTS) fonctionne aussi bien pour le développement local — voir `scripts/local-node-runner.js` ci-dessous.

Depuis ce dossier, installer les dépendances avec :

```bash
npm ci
```

## Démarrer localement

```bash
npm run start:local
```

L'API et l'administration Strapi sont alors disponibles sur <http://127.0.0.1:1338>.

Cette commande est celle à privilégier pour un lancement local : elle utilise toujours la base SQLite `.tmp/data-local.db` et stocke les médias dans `public/uploads`. Elle ne recharge pas automatiquement l'application après une modification.

Le script choisit automatiquement un runtime Node compatible, sans manipulation manuelle : il liste les versions installées via [nvm-windows](https://github.com/coreybutler/nvm-windows) (dossier `%NVM_HOME%`) ainsi que le binaire Node actif, et retient la plus récente qui satisfait à la fois Strapi (Node 20+) et le binaire natif `better-sqlite3` déjà compilé — inutile de faire `nvm use` avant de lancer la commande. `LOCAL_NODE_BINARY`, si défini, force le binaire à utiliser en priorité. Si aucune version ≥ 20 compatible n'est trouvée, un avertissement est affiché et il faut alors installer une version récente avec `nvm install 22` (ou `24`, en compilant `better-sqlite3` depuis les sources avec Visual Studio Build Tools).

## Développer avec le rechargement automatique

Créer le fichier `.env` à partir de `.env.example`, renseigner au minimum `APP_KEYS`, puis lancer :

```bash
npm run develop
```

En mode développement (`NODE_ENV=development`), Strapi utilise SQLite et le stockage local. Vérifier que `NODE_ENV` n'est pas défini à `production` dans le terminal ou dans `.env` avant d'exécuter cette commande.

## Construire localement

```bash
npm run build
```

Cette commande construit l'interface d'administration Strapi. Pour démarrer ensuite l'application avec les données locales :

```bash
npm run start:local
```

## Prévisualisation des projets

La [Preview de Strapi](https://docs.strapi.io/cms/features/preview) ouvre directement `/project/:slug` dans le portfolio Angular, avec la version enregistrée (`draft` ou `published`) et la langue choisies dans l'administration. Enregistrer les modifications avant d'ouvrir la preview.

`npm run start:local` active automatiquement la preview vers `http://127.0.0.1:4200` et génère un secret temporaire à chaque démarrage. Démarrer également le portfolio avec `npm run start:local` dans le dossier front-end.

Pour un lancement classique ou en production, définir dans l'environnement **du back-end uniquement** :

```dotenv
PREVIEW_URL=https://www.aurore-salavert.fr
PREVIEW_SECRET=<secret-aleatoire-de-32-octets-minimum>
```

`PREVIEW_URL` est l'origine du portfolio, sans `/preview` ni `/project`. Générer un secret avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Redémarrer Strapi après modification. Le front-end modifié doit être déployé également.

Seuls les projets avec un slug proposent une preview. Strapi crée un lien signé valable 30 minutes, limité au document, au statut et à la langue sélectionnés. Le secret reste dans Strapi ; aucun jeton API n'est inclus dans le bundle Angular. L'endpoint `/api/project-preview?token=...` vérifie la signature et l'expiration avant de lire le document et ses médias, catégories et layout. Les réponses ne sont pas mises en cache. Ne pas partager les liens de preview : ils donnent accès à cette version du projet pendant leur validité.

Le portfolio affiche un indicateur de prévisualisation, désactive la navigation vers les autres projets et demande aux robots de ne pas indexer la page. Un lien invalide ou expiré affiche un message invitant à rouvrir la preview depuis Strapi. Il s'agit de la version enregistrée, sans actualisation automatique des modifications non sauvegardées.

Strapi autorise automatiquement l'origine du portfolio dans sa CSP. Si un proxy ajoute des en-têtes `X-Frame-Options` ou `frame-ancestors` au portfolio, autoriser l'origine de l'administration pour l'affichage intégré.

Validation : `node --test tests/preview.test.js`, compilation Angular, puis ouvrir un brouillon et une version publiée en français et en anglais depuis l'administration.
## Commandes utiles

```bash
# Vérifier qu'un runtime Node compatible avec SQLite est disponible
node scripts/local-node-runner.js start-local.js --check

# Synchroniser les contenus de production vers l'environnement local
npm run sync:production-content
```

La synchronisation lit la production et écrit uniquement dans SQLite et `public/uploads`. Pour une vue d'ensemble des environnements, consulter [ENVIRONMENTS.md](../ENVIRONMENTS.md).
