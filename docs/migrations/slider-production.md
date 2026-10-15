# Migration du slider vers la production

État : préparation uniquement. Aucun déploiement ou changement de contenu en production n'a été effectué.

Contrôle public du 15 octobre 2026 : les quatre médias exportés sont retrouvés par hash ou nom dans la Gallery publiée en production. Ce contrôle ne remplace pas le plan authentifié ni la validation des relations après déploiement.

## Contenu à transférer

`slider-content.json` contient les quatre slides **publiées** exportées du Strapi local, dans leur ordre : images (hash, nom et dimensions), textes Blocks, projet (slug et locale), position et thème. Il ne contient ni ID local, ni fichier image, ni URL S3 signée, ni jeton.

Relancer l'export si les accroches ou les réglages sont modifiés avant livraison :

```powershell
node scripts/migrate-slider.js export
```

Le serveur local doit être disponible sur le port 1338. Le script n'ouvre pas de connexion à la base et ne démarre pas Strapi.

## Prérequis

- Faire relire les PR backend #4 et frontend #57, puis obtenir l'accord de fusion/déploiement. Publier une branche ou une PR n'autorise pas la mise en production.
- Vérifier les versions réellement déployées et la méthode de déploiement des deux applications.
- Prévoir une courte fenêtre de maintenance : le nouveau schéma retire Gallery, alors que l'ancien frontend l'utilise. Ne pas laisser durablement le nouveau backend avec l'ancien frontend.
- Prendre une sauvegarde complète de la base PostgreSQL **avant le déploiement du schéma**, et noter les releases/commits backend et frontend à restaurer. La sauvegarde de contenu JSON ne remplace pas cette sauvegarde : la synchronisation du schéma peut supprimer les anciennes relations Gallery.
- Disposer temporairement d'un jeton Strapi de l'environnement cible autorisant uniquement les lectures Slider Item, Project et Upload/find, et la mise à jour Slider Item pour l'application. Ne pas modifier les permissions publiques pour cette migration. Ne pas écrire le jeton dans Git, un fichier de commandes ou un message.
- Les quatre médias et les projets doivent déjà exister dans la cible. Le script ne téléverse et ne remplace aucun média, ne modifie aucun projet. Tout média ou projet absent/ambigu arrête le plan avant écriture.

## Avant le déploiement du backend : sauvegarde du contenu existant

Depuis le dossier backend, renseigner les variables de session. Fournir le jeton via l'environnement du terminal, sans le copier dans le document :

```powershell
$env:SLIDER_TARGET_URL = 'https://strapi.aurore-salavert.fr'
# SLIDER_API_TOKEN doit être fourni dans l'environnement du terminal.
node scripts/migrate-slider.js backup
```

Cette commande lit et sauvegarde le brouillon et la publication, avec l'ancienne Gallery si elle existe. Les fichiers sont conservés localement dans `.tmp/slider-backups/` (ignoré par Git). Les conserver hors des conteneurs éphémères. En cas d'erreur HTTP, corriger les accès avant de continuer.

## Après le déploiement du nouveau schéma : plan sans écriture

```powershell
node scripts/migrate-slider.js plan
```

Le script résout les médias dans la bibliothèque cible par hash puis par nom, refuse les doublons et contrôle les dimensions et le type. Les projets sont recherchés parmi les publications par slug **et locale**. Aucun ID de la base locale n'est réutilisé.

Relire le plan et vérifier visuellement les médias cibles. Le rapprochement nom/dimensions n'est pas une comparaison binaire des images.

## Application après accord explicite

Alternative retenue pour la livraison Heroku : `scripts/migrate-slider-in-app.js` résout les mêmes références via les services internes Strapi, dans un dyno ponctuel du backend. Aucun jeton API supplémentaire n'est créé. La sauvegarde PostgreSQL doit être terminée avant le déploiement du schéma.

```powershell
heroku run --no-tty -a auroresalavert-backend "node scripts/migrate-slider-in-app.js"
heroku run --no-tty -a auroresalavert-backend "node scripts/migrate-slider-in-app.js --apply --confirm-target=auroresalavert-backend"
```

La première commande prépare le plan ; la seconde met à jour et publie, vérifie les deux états et configure Title comme titre d'affichage. Exécuter uniquement après accord de mise en production. Le plan charge Strapi dans l'environnement déjà déployé ; il n'écrit pas le contenu du slider.

```powershell
node scripts/migrate-slider.js apply --confirm-target=https://strapi.aurore-salavert.fr
```

Une nouvelle sauvegarde du contenu cible est prise avant le PUT. L'application remplace intégralement les slides du Single Type et publie la version exportée : les éventuelles modifications de brouillon de la cible sont donc remplacées elles aussi. Le script vérifie ensuite le brouillon et la publication, incluant l'ordre, les images, les projets, les textes et les réglages. Une nouvelle exécution avec le même contenu n'écrit rien lorsque les deux versions correspondent déjà.

Si l'écriture ou la vérification échoue, arrêter la livraison et consulter la sauvegarde. Aucune restauration automatique n'est lancée pour éviter d'écraser une modification concurrente.

## Validation et mise en ligne du frontend

1. Vérifier que l'API publique renvoie les quatre Slides avec Image et Project peuplés, sans jeton :
   `https://strapi.aurore-salavert.fr/api/slider-item?status=published&populate[Slides][populate][Image]=true&populate[Slides][populate][Project]=true`.
2. Dans Strapi, choisir Title comme champ d'affichage du Single Type si l'identifiant reste affiché. Le bootstrap automatique du titre est limité au développement ; l'import renseigne bien Title en production, mais pas la configuration du Content Manager.
3. Déployer le frontend correspondant et vérifier les quatre images, liens projet, scrolls portfolio/contact et glissements (y compris bouclage dernière/première).
4. Vérifier le rendu mobile sur les fonds sombre, jaune, vert et noir/blanc, ainsi que le contraste après redimensionnement. La lecture des pixels nécessite que les réponses S3 signées autorisent les requêtes CORS GET depuis l'origine du portfolio. Le CORS du serveur Strapi ne suffit pas pour les images servies par S3. Le script ne change aucune configuration du bucket ; sans cet accès, le thème manuel sert de repli.
5. Contrôler la version FR et la version EN : les libellés CTA sont traduits côté frontend ; les accroches du Single Type sont communes et restent celles de l'export.
6. Retirer le jeton de la session après utilisation et le révoquer s'il a été créé pour cette migration.

## Retour arrière

En cas d'échec global, maintenir la fenêtre de maintenance, restaurer ensemble la release backend précédente **et la sauvegarde PostgreSQL prise avant changement de schéma**, puis revenir au frontend précédent. Restaurer seulement le code ne recrée pas les anciennes relations Gallery. Les sauvegardes JSON servent à retrouver les contenus draft/published et à corriger une migration ciblée après diagnostic ; elles ne constituent pas une restauration complète de la base.

## Vérifications de préparation

```powershell
node --check scripts/migrate-slider.js
node --test scripts/migrate-slider.test.js
```

Le plan de production et l'application restent à exécuter dans la fenêtre de livraison après autorisation et fourniture du jeton. L'export local et les tests ne valident pas les médias, les permissions, le CORS S3 ni les releases de production.
