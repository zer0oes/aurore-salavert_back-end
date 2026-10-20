# Bandeau cookies

Dans **Content Manager > Single Types > Cookie banner**, renseigner puis publier les textes pour chaque langue (FR et EN).

| Champ | Texte concerné |
| --- | --- |
| Message | Texte principal du bandeau |
| PolicyLinkLabel | Lien vers la politique de confidentialité, affiché à la fin du message |
| AcceptLabel | Bouton d’acceptation |
| RejectLabel | Bouton de refus |
| ManageLabel | Lien du pied de page qui rouvre le bandeau |

Les champs vides utilisent les textes par défaut du front-end. Le comportement du consentement (durée de validité de 6 mois, chargement de Google Analytics) reste défini dans le front-end.

Le bandeau publié est accessible en lecture via `/api/cookie-banner?locale=fr` ou `/api/cookie-banner?locale=en`. Seule l’action publique `find` est activée au démarrage. La modification et la publication restent réservées à l’administration Strapi.
