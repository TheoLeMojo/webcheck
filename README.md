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
2. Configurez votre clé API Perplexity (voir section ci-dessous)
3. Ouvrez Chrome et accédez à `chrome://extensions/`
4. Activez le "Mode développeur" (en haut à droite)
5. Cliquez sur "Charger l'extension non empaquetée"
6. Sélectionnez le dossier contenant les fichiers de cette extension

## Configuration de l'API Perplexity

Pour utiliser cette extension, vous devez disposer d'une clé API Perplexity :

1. Obtenez une clé API sur [Perplexity AI](https://www.perplexity.ai/)
2. Copiez le fichier `config.example.js` vers `config.js`
3. Ouvrez `config.js` et remplacez `"votre-clé-api-perplexity-ici"` par votre clé API réelle
4. (Optionnel) Ajustez les autres paramètres selon vos besoins

**Important :** Le fichier `config.js` contenant votre clé API est inclus dans `.gitignore` pour éviter qu'il ne soit partagé publiquement. Ne le committez jamais dans le dépôt.

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

## Comment fonctionne l'API Perplexity

L'extension utilise l'API Perplexity pour vérifier la véracité des informations :

1. Le contenu de la page est extrait et divisé en paragraphes
2. Chaque paragraphe est envoyé à l'API Perplexity avec une instruction stricte d'utiliser uniquement les sources vérifiées
3. La réponse de l'API est analysée pour extraire le statut de véracité, l'explication et les sources utilisées
4. Les résultats sont affichés dans l'interface de l'extension

En cas d'erreur API ou si vous n'avez pas configuré votre clé API, l'extension basculera automatiquement vers un mode de simulation pour les démonstrations.

## Limitations

- La qualité de la vérification dépend de la pertinence des sources vérifiées que vous spécifiez
- Les limites de l'API Perplexity s'appliquent (quotas, vitesse, etc.)
- Pour les contenus très longs, seuls les paragraphes les plus pertinents seront vérifiés

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
- `config.example.js` : Exemple de configuration de l'API (à copier vers `config.js`)
- `config.js` : Configuration réelle avec votre clé API (non inclus dans le dépôt)
- `trusted_sources.json` : Liste des sources vérifiées par défaut
- `images/` : Dossier contenant les icônes

### TODO

- Améliorer l'algorithme d'extraction des paragraphes
- Ajouter des options de configuration supplémentaires
- Implémenter une fonctionnalité de cache pour réduire les appels API 