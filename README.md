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

## Prévisualisation des contenus

Strapi 5.52.3, déjà installé, inclut la fonctionnalité [Preview](https://docs.strapi.io/cms/features/preview) : aucune mise à jour de dépendance n'est nécessaire.

La configuration back-end est prête mais reste désactivée tant que `PREVIEW_URL` et `PREVIEW_SECRET` ne sont pas renseignés. Le front-end doit encore implémenter la route correspondante avant de les configurer. Exemple local :

```dotenv
PREVIEW_URL=http://127.0.0.1:4200/preview
PREVIEW_SECRET=<secret-aleatoire-partage-avec-le-serveur-front-end>
```

En production, utiliser une route HTTPS, par exemple `https://www.aurore-salavert.fr/preview`, et un secret distinct. Redémarrer Strapi après modification. L'origine de cette URL est autorisée automatiquement dans la politique CSP de l'administration pour afficher la prévisualisation intégrée.

Le bouton Preview transmet à cette route les paramètres `secret`, `uid` (par exemple `api::project.project`), `documentId`, `status` (`draft` ou `published`), `locale` si disponible et `slug` si le document en possède un. Les contenus introuvables et les types internes à Strapi n'ont pas de lien Preview. Les différents types de contenus sont dirigés vers ce point d'entrée unique : le front-end choisit ensuite la page ou la section à afficher selon `uid` et `slug`.

La route front-end doit vérifier le secret côté serveur, valider les paramètres, puis lire le document Strapi avec le statut et la langue demandés. L'accès aux brouillons doit utiliser un jeton Strapi conservé côté serveur avec les permissions de lecture nécessaires ; ne pas ouvrir leur accès au rôle Public. Ne jamais inclure ce jeton ou le secret dans le bundle navigateur. Après validation, établir une session de prévisualisation et rediriger vers une URL sans secret ; éviter de journaliser la chaîne de requête.

Le front-end doit également autoriser son affichage en iframe depuis l'origine de l'administration Strapi (`Content-Security-Policy: frame-ancestors ...`, sans `X-Frame-Options` incompatible). Vérifier ensuite un projet brouillon, sa version publiée et une autre langue depuis l'administration. Tant que cette route n'existe pas, la prévisualisation de bout en bout n'est pas disponible.

Vérifier la génération des liens avec `node --test tests/preview.test.js`.

## Commandes utiles

```bash
# Vérifier qu'un runtime Node compatible avec SQLite est disponible
node scripts/local-node-runner.js start-local.js --check

# Synchroniser les contenus de production vers l'environnement local
npm run sync:production-content
```

La synchronisation lit la production et écrit uniquement dans SQLite et `public/uploads`. Pour une vue d'ensemble des environnements, consulter [ENVIRONMENTS.md](../ENVIRONMENTS.md).
