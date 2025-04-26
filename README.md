# WebCheck Verifier

Une extension Chrome qui vérifie la véracité des informations d'une page web en utilisant Perplexity.

## Fonctionnalités

- Extraction du contenu principal de la page web actuelle
- Envoi du contenu à Perplexity pour vérification
- Possibilité de spécifier des sources de confiance pour la vérification
- Affichage des résultats de vérification avec indication des informations vraies, fausses ou partiellement vraies

## Installation

1. Clonez ce dépôt ou téléchargez les fichiers
2. Ouvrez Chrome et accédez à `chrome://extensions/`
3. Activez le "Mode développeur" (en haut à droite)
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant les fichiers de cette extension

## Utilisation

1. Naviguez vers une page web dont vous souhaitez vérifier les informations
2. Cliquez sur l'icône de l'extension dans la barre d'outils
3. (Optionnel) Ajoutez des sources vérifiées dans la zone de texte
4. Cliquez sur "Vérifier cette page"
5. Attendez que les résultats de vérification apparaissent

## Limitations

- L'API officielle de Perplexity n'étant pas publiquement documentée, cette implémentation est simulée
- Pour une utilisation réelle, vous devrez implémenter votre propre solution d'intégration avec Perplexity
- La taille du contenu extrait est limitée à 5000 caractères pour éviter des requêtes trop volumineuses

## Permissions

- `activeTab` : Pour accéder au contenu de l'onglet actif
- `scripting` : Pour exécuter des scripts dans la page web
- `storage` : Pour sauvegarder les sources de confiance

## Développement

### Structure des fichiers

- `manifest.json` : Configuration de l'extension
- `popup.html` : Interface utilisateur de l'extension
- `popup.css` : Styles pour l'interface
- `popup.js` : Logique de l'extension
- `images/` : Dossier contenant les icônes

### TODO

- Implémenter une véritable intégration avec l'API Perplexity lorsqu'elle sera disponible
- Améliorer l'algorithme d'extraction de contenu
- Ajouter des options de configuration supplémentaires 