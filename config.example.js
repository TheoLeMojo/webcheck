// Exemple de configuration - Copiez ce fichier vers config.js et ajoutez votre clé API
const config = {
  // Clé API Perplexity - À CONFIGURER
  // ⚠️ REMPLACEZ CETTE VALEUR PAR VOTRE PROPRE CLÉ API PERPLEXITY ⚠️
  PERPLEXITY_API_KEY: "votre-clé-api-perplexity-ici",
  
  // URL de l'API Perplexity
  PERPLEXITY_API_URL: "https://api.perplexity.ai/chat/completions",
  
  // Paramètres de l'API
  API_PARAMS: {
    model: "llama-3-sonar-small-32k-online",  // Modèle à utiliser
    max_tokens: 1024,                        // Nombre maximal de tokens en sortie
    temperature: 0.1,                        // Température (plus basse pour des réponses plus factuelles)
    presence_penalty: 0,                     // Pénalité de présence
    top_p: 0.9                              // Top-p sampling
  }
};

// Ne pas modifier ce qui suit
export default config; 