#!/bin/bash

# Script pour convertir les fichiers SVG en PNG
# Nécessite inkscape ou autre convertisseur SVG vers PNG

# Fonction pour vérifier si Inkscape est installé
check_inkscape() {
  if ! command -v inkscape &> /dev/null; then
    echo "Inkscape n'est pas installé."
    echo "Pour Mac: brew install inkscape"
    echo "Pour Linux: sudo apt-get install inkscape"
    echo "Pour Windows: télécharger depuis https://inkscape.org/"
    exit 1
  fi
}

# Vérifier la présence d'Inkscape
check_inkscape

# Conversion des icônes
echo "Conversion des icônes SVG en PNG..."

# Convertir icon16.png.svg en icon16.png
inkscape --export-filename=images/icon16.png images/icon16.png.svg

# Convertir icon48.png.svg en icon48.png
inkscape --export-filename=images/icon48.png images/icon48.png.svg

# Convertir icon128.png.svg en icon128.png
inkscape --export-filename=images/icon128.png images/icon128.png.svg

echo "Conversion terminée !" 