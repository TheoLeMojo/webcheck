# WebCheck Verifier

Une extension Chrome qui vérifie la véracité des informations d'une page web en utilisant Perplexity, en se limitant strictement aux sources vérifiées.

## Fonctionnalités

- Extraction et analyse individuelle de chaque paragraphe de la page web
- Vérification de la véracité des informations avec Perplexity
- **Restriction aux sources vérifiées uniquement** : Perplexity n'utilisera que les sources spécifiées
- Deux types de sources vérifiées :
  - Sources par défaut fournies par l'extension
  - Sources personnelles ajoutées par l'utilisateur
- Affichage des résultats de vérification pour chaque paragraphe avec indication claire du statut (vrai, faux, partiellement vrai, non vérifiable)

## Installation

1. Clonez ce dépôt ou téléchargez les fichiers
2. Ouvrez Chrome et accédez à `chrome://extensions/`
3. Activez le "Mode développeur" (en haut à droite)
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant les fichiers de cette extension

## Utilisation

1. Naviguez vers une page web dont vous souhaitez vérifier les informations
2. Cliquez sur l'icône de l'extension dans la barre d'outils
3. (Optionnel) Consultez les sources vérifiées par défaut et ajoutez vos propres sources
4. Cliquez sur "Vérifier cette page"
5. L'extension analysera chaque paragraphe de la page individuellement
6. Les résultats de vérification s'afficheront pour chaque paragraphe, avec le statut de véracité et les sources utilisées

## Sources vérifiées

### Sources par défaut

L'extension est préchargée avec une liste de sources fiables (sites d'information reconnus, organismes gouvernementaux, institutions scientifiques, etc.). Ces sources sont définies dans le fichier `trusted_sources.json`.

### Sources personnelles

Vous pouvez ajouter vos propres sources vérifiées qui seront utilisées en complément des sources par défaut. Ces sources sont stockées localement dans votre navigateur et ne sont pas partagées.

## Restriction à l'utilisation des sources spécifiées

Une caractéristique clé de cette extension est sa capacité à restreindre Perplexity pour qu'il utilise **uniquement** les sources vérifiées spécifiées. Si une information ne peut pas être vérifiée à l'aide de ces sources, elle sera marquée comme "non vérifiable" plutôt que d'utiliser d'autres sources potentiellement non fiables.

## Limitations

- L'API officielle de Perplexity n'étant pas publiquement documentée, cette implémentation est simulée
- Pour une utilisation réelle, vous devrez implémenter votre propre solution d'intégration avec Perplexity
- La qualité de la vérification dépend de la pertinence des sources vérifiées que vous spécifiez

## Permissions

- `activeTab` : Pour accéder au contenu de l'onglet actif
- `scripting` : Pour exécuter des scripts dans la page web
- `storage` : Pour sauvegarder les sources de confiance personnelles

## Développement

### Structure des fichiers

- `manifest.json` : Configuration de l'extension
- `popup.html` : Interface utilisateur de l'extension
- `popup.css` : Styles pour l'interface
- `popup.js` : Logique de l'extension
- `trusted_sources.json` : Liste des sources vérifiées par défaut
- `images/` : Dossier contenant les icônes

### TODO

- Implémenter une véritable intégration avec l'API Perplexity lorsqu'elle sera disponible
- Améliorer l'algorithme d'extraction des paragraphes
- Ajouter des options de configuration supplémentaires 