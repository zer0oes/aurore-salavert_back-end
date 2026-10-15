# Statistiques Google Analytics

Le menu **Statistiques** affiche les utilisateurs actifs, sessions, pages vues,
taux d’engagement, pages, sources, pays et appareils sur 7, 30 ou 90 jours.
Il lit la propriété existante sans ajouter de suivi au site.
Une courbe interactive affiche les utilisateurs, sessions ou pages vues par
jour. Les jours sans activité sont complétés à zéro dans le fuseau horaire de
la propriété Google Analytics. Les répartitions sont présentées en barres.

## Connexion à Google

1. Dans Google Analytics, ouvrir Administration > Paramètres de la propriété >
   Détails de la propriété et relever son **identifiant numérique**.
   `G-HC971RXVZG` est l’identifiant de mesure du site, pas celui de la propriété.
2. Dans https://console.cloud.google.com/, sélectionner ou créer un projet et
   activer **Google Analytics Data API**.
3. Dans IAM et administration > Comptes de service, créer un compte de service,
   puis une clé JSON. Aucun rôle Google Cloud supplémentaire n’est nécessaire.
4. Dans Google Analytics > Administration > Gestion des accès à la propriété,
   ajouter l’adresse `client_email` du compte avec le rôle **Lecteur**.
5. Placer la clé JSON hors du dépôt et du dossier public. Dans `.env`, définir :

   ```dotenv
   GA4_PROPERTY_ID=123456789
   GA4_SERVICE_ACCOUNT_FILE=C:/chemin/prive/analytics-reader.json
   ```

   Sur l’hébergement, définir `GA4_PROPERTY_ID` et la variable secrète
   `GA4_SERVICE_ACCOUNT_JSON` contenant le JSON complet à la place du chemin.
   Ne jamais préfixer ces variables par une variable d’environnement publique,
   ni transmettre la clé dans le chat ou la committer.
6. Redémarrer Strapi. En production, reconstruire l’administration lors du
   déploiement (`npm run build`). Configurer séparément chaque environnement.
7. Se connecter à Strapi et ouvrir **Statistiques**. Pour les rôles autres que
   Super Admin, autoriser « Statistiques / Consulter les statistiques » dans
   les permissions du rôle administrateur.

## Vérification

Comparer les résultats avec GA4 sur la même propriété et la même période.
Les totaux sont demandés à Google sans dimension quotidienne : un visiteur
revenant plusieurs jours ne se retrouve pas additionné plusieurs fois.
Les résultats sont conservés cinq minutes en mémoire serveur. La journée en
cours et les données récentes peuvent encore évoluer dans Google Analytics.

Les routes sont de type admin, avec authentification et permission dédiée.
Les clés restent côté serveur. Aucune route publique de réglages n’est créée.
