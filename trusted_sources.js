// Module qui charge les sources fiables depuis le fichier JSON
let trustedSources = [];

// Fonction pour charger les sources depuis le fichier JSON
async function loadTrustedSources() {
  try {
    const response = await fetch('trusted_sources.json');
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    const data = await response.json();
    trustedSources = data.sources || [];
    return trustedSources;
  } catch (error) {
    console.error('Erreur lors du chargement des sources fiables:', error);
    return [];
  }
}

// Fonction pour obtenir les sources fiables
export async function getTrustedSources() {
  if (trustedSources.length === 0) {
    // Si les sources n'ont pas encore été chargées, les charger
    return await loadTrustedSources();
  }
  return trustedSources;
}

// Charger les sources au démarrage
loadTrustedSources();

export default { getTrustedSources }; 