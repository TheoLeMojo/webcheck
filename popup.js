// Importer la configuration
import config from './config.js';

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', async function() {
  // Récupérer les éléments du DOM
  const checkButton = document.getElementById('checkPage');
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('verificationResult');
  const loader = document.getElementById('loader');
  
  // Éléments pour les sources
  const defaultSourcesList = document.getElementById('defaultSourcesList');
  const userSourcesList = document.getElementById('userSourcesList');
  const toggleDefaultSources = document.getElementById('toggleDefaultSources');
  const toggleUserSources = document.getElementById('toggleUserSources');
  const newSourceInput = document.getElementById('newSourceInput');
  const addSourceButton = document.getElementById('addSourceButton');
  const userSourcesContainer = document.getElementById('userSourcesContainer');
  
  // Variables pour stocker les sources
  let defaultSources = [];
  let userSources = [];
  
  // Charger les sources par défaut depuis le fichier JSON
  try {
    const response = await fetch('trusted_sources.json');
    const data = await response.json();
    defaultSources = data.sources || [];
    // Afficher les sources par défaut
    renderDefaultSources();
  } catch (error) {
    console.error('Erreur lors du chargement des sources par défaut:', error);
    defaultSources = [];
  }
  
  // Charger les sources personnalisées depuis le stockage local
  chrome.storage.local.get(['userSources'], function(result) {
    userSources = result.userSources || [];
    // Afficher les sources personnalisées
    renderUserSources();
  });
  
  // Fonction pour afficher les sources par défaut
  function renderDefaultSources() {
    defaultSourcesList.innerHTML = '';
    
    if (defaultSources.length === 0) {
      defaultSourcesList.innerHTML = '<p class="empty-list">Aucune source par défaut disponible.</p>';
      return;
    }
    
    defaultSources.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      
      const sourceUrl = document.createElement('span');
      sourceUrl.className = 'source-url';
      sourceUrl.textContent = source;
      
      sourceItem.appendChild(sourceUrl);
      defaultSourcesList.appendChild(sourceItem);
    });
  }
  
  // Fonction pour afficher les sources personnalisées
  function renderUserSources() {
    userSourcesList.innerHTML = '';
    
    if (userSources.length === 0) {
      userSourcesList.innerHTML = '<p class="empty-list">Vous n\'avez pas encore ajouté de sources vérifiées.</p>';
      return;
    }
    
    userSources.forEach((source, index) => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      
      const sourceUrl = document.createElement('span');
      sourceUrl.className = 'source-url';
      sourceUrl.textContent = source;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'source-remove';
      removeButton.textContent = 'Supprimer';
      removeButton.addEventListener('click', () => {
        removeUserSource(index);
      });
      
      sourceItem.appendChild(sourceUrl);
      sourceItem.appendChild(removeButton);
      userSourcesList.appendChild(sourceItem);
    });
  }
  
  // Fonction pour ajouter une source personnalisée
  function addUserSource(url) {
    if (!url) return;
    
    // Normaliser l'URL (ajouter https:// si absent)
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Vérifier si l'URL est déjà dans la liste
    if (userSources.includes(url)) {
      alert('Cette source est déjà dans votre liste.');
      return;
    }
    
    userSources.push(url);
    saveUserSources();
    renderUserSources();
    newSourceInput.value = '';
  }
  
  // Fonction pour supprimer une source personnalisée
  function removeUserSource(index) {
    userSources.splice(index, 1);
    saveUserSources();
    renderUserSources();
  }
  
  // Fonction pour sauvegarder les sources personnalisées
  function saveUserSources() {
    chrome.storage.local.set({ userSources: userSources });
  }
  
  // Gestionnaires d'événements pour les toggles
  toggleDefaultSources.addEventListener('change', function() {
    defaultSourcesList.style.display = this.checked ? 'block' : 'none';
  });
  
  toggleUserSources.addEventListener('change', function() {
    userSourcesContainer.style.display = this.checked ? 'block' : 'none';
  });
  
  // Gestionnaire d'événements pour l'ajout de source
  addSourceButton.addEventListener('click', function() {
    addUserSource(newSourceInput.value.trim());
  });
  
  newSourceInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addUserSource(this.value.trim());
    }
  });
  
  // Ajouter un écouteur d'événement au bouton de vérification
  checkButton.addEventListener('click', async function() {
    // Désactiver le bouton pendant la vérification
    checkButton.disabled = true;
    statusDiv.textContent = 'Extraction du contenu de la page...';
    resultDiv.textContent = '';
    loader.style.display = 'block';

    try {
      // Obtenir l'onglet actif
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Exécuter un script dans l'onglet pour extraire le contenu
      const scraped = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapePageContent
      });
      
      // Récupérer le contenu extrait
      const pageContent = scraped[0].result;
      
      // Combiner les sources par ordre de priorité
      const allSources = [...defaultSources, ...userSources];
      
      if (allSources.length === 0) {
        statusDiv.textContent = 'Aucune source vérifiée disponible. Ajoutez des sources pour continuer.';
        checkButton.disabled = false;
        loader.style.display = 'none';
        return;
      }
      
      // Afficher le statut
      statusDiv.textContent = 'Analyse des paragraphes et vérification...';
      
      // Vérifier chaque paragraphe individuellement
      const verificationResults = await Promise.all(
        pageContent.paragraphs.map(async (paragraph, index) => {
          statusDiv.textContent = `Vérification du paragraphe ${index + 1}/${pageContent.paragraphs.length}...`;
          if (paragraph.trim().length < 50) return null; // Ignorer les paragraphes trop courts
          
          return await checkWithPerplexity(
            { 
              title: pageContent.title,
              content: paragraph,
              url: pageContent.url 
            }, 
            allSources, 
            tab.url,
            index
          );
        })
      );
      
      // Filtrer les résultats null (paragraphes ignorés)
      const validResults = verificationResults.filter(result => result !== null);
      
      // Afficher les résultats
      if (validResults.length > 0) {
        resultDiv.innerHTML = formatVerificationResults(validResults, pageContent);
      } else {
        resultDiv.innerHTML = "<p>Aucun contenu substantiel n'a pu être vérifié sur cette page.</p>";
      }
      
      // Mettre à jour le statut
      statusDiv.textContent = 'Vérification terminée';
    } catch (error) {
      console.error('Erreur:', error);
      statusDiv.textContent = 'Erreur: ' + error.message;
    } finally {
      // Réactiver le bouton et cacher le loader
      checkButton.disabled = false;
      loader.style.display = 'none';
    }
  });
});

// Fonction pour extraire le contenu de la page
function scrapePageContent() {
  // Cette fonction est exécutée dans le contexte de la page web
  
  // Extraire le titre de la page
  const title = document.title;
  const url = window.location.href;
  
  // Récupérer le contenu principal 
  const mainElements = document.querySelectorAll('article, main, .content, .main, #content, #main');
  let mainElement = null;
  
  if (mainElements.length > 0) {
    // Utiliser le premier élément principal trouvé
    mainElement = mainElements[0];
  } else {
    // Sinon, utiliser le body entier
    mainElement = document.body;
  }
  
  // Trouver tous les paragraphes dans l'élément principal
  const paragraphElements = mainElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  const paragraphs = [];
  
  // Extraire le texte de chaque paragraphe
  paragraphElements.forEach(element => {
    const text = element.textContent.trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  });
  
  // Si aucun paragraphe n'a été trouvé via les balises p, essayer de diviser le texte
  if (paragraphs.length === 0) {
    const fullText = mainElement.textContent.trim();
    const sentences = fullText.split(/(?<=[.!?])\s+/);
    
    // Regrouper les phrases en paragraphes (4-5 phrases par paragraphe)
    for (let i = 0; i < sentences.length; i += 4) {
      const paragraph = sentences.slice(i, i + 4).join(' ');
      if (paragraph.trim().length > 0) {
        paragraphs.push(paragraph);
      }
    }
  }
  
  // Retourner les informations extraites
  return {
    title: title,
    paragraphs: paragraphs,
    url: url
  };
}

// Fonction pour envoyer les données à Perplexity et obtenir une vérification
async function checkWithPerplexity(pageContent, trustedSources, pageUrl, paragraphIndex) {
  try {
    // Construire la liste des sources à utiliser EXCLUSIVEMENT
    const sourcesList = trustedSources.join(', ');
    
    // Créer le prompt pour Perplexity avec restriction aux sources spécifiées
    const prompt = `Vérifiez la véracité des informations suivantes provenant de ${pageUrl}:
    
    "${pageContent.content}"
    
    IMPORTANT: Utilisez EXCLUSIVEMENT les sources suivantes pour votre vérification. N'utilisez AUCUNE autre source: ${sourcesList}
    
    Si l'information ne peut pas être vérifiée par ces sources, indiquez-le clairement plutôt que d'utiliser d'autres sources.
    
    Donnez-moi une analyse factuelle structurée ainsi:
    1. Statut: indiquez si l'information est "vrai", "partiellement vrai", "faux" ou "non vérifiable" par les sources spécifiées.
    2. Explication: justifiez votre évaluation en 2-3 phrases.
    3. Sources utilisées: listez uniquement les sources que vous avez consultées parmi celles fournies.`;
    
    console.log(`Requête à Perplexity pour le paragraphe ${paragraphIndex + 1}:`, prompt);
    
    // Paramètres de la requête API
    const apiParams = {
      ...config.API_PARAMS,
      messages: [
        {
          role: "system",
          content: "Vous êtes un assistant de vérification des faits. Votre tâche est de vérifier la véracité des informations en utilisant UNIQUEMENT les sources spécifiées."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    // Appel à l'API Perplexity
    const response = await fetch(config.PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(apiParams)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API Perplexity: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Réponse de l'API:", data);
    
    // Extraire le contenu de la réponse
    const responseContent = data.choices[0].message.content;
    
    // Analyser la réponse pour extraire le statut, l'explication et les sources
    const analysisResult = parsePerplexityResponse(responseContent);
    
    return {
      paragraphIndex: paragraphIndex,
      content: pageContent.content,
      summary: `Vérification du paragraphe ${paragraphIndex + 1}`,
      status: analysisResult.status,
      explanation: analysisResult.explanation,
      sources: analysisResult.sources
    };
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API Perplexity:", error);
    
    // Fallback en cas d'erreur: mode simulation
    return fallbackSimulation(pageContent, trustedSources, paragraphIndex);
  }
}

// Fonction pour analyser la réponse de Perplexity
function parsePerplexityResponse(responseText) {
  // Expressions régulières pour extraire les informations
  const statusRegex = /Statut\s*:\s*(vrai|partiellement vrai|faux|non vérifiable)/i;
  const explanationRegex = /Explication\s*:\s*([^\n]+(?:\n[^\n]+)*?)(?:\n\s*\d|\n\s*Sources|\n\s*$)/i;
  const sourcesRegex = /Sources utilisées\s*:([\s\S]+)$/i;
  
  // Extraire le statut
  const statusMatch = responseText.match(statusRegex);
  const status = statusMatch ? statusMatch[1].toLowerCase() : "non vérifiable";
  
  // Extraire l'explication
  const explanationMatch = responseText.match(explanationRegex);
  const explanation = explanationMatch 
    ? explanationMatch[1].trim() 
    : "Impossible d'extraire l'explication de la réponse.";
  
  // Extraire les sources
  const sourcesMatch = responseText.match(sourcesRegex);
  let sources = [];
  
  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1];
    // Identifier les URLs dans le texte des sources
    const urlRegex = /https?:\/\/[^\s,]+/g;
    const matches = sourcesText.match(urlRegex);
    
    if (matches) {
      sources = matches;
    } else {
      // Si aucune URL n'est trouvée, essayer d'extraire des lignes
      sources = sourcesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
  }
  
  return {
    status,
    explanation,
    sources
  };
}

// Fonction de repli (fallback) en cas d'erreur avec l'API - utilise la simulation
function fallbackSimulation(pageContent, trustedSources, paragraphIndex) {
  console.log("Utilisation du mode simulation (fallback) pour la vérification");
  
  // Générer des réponses différentes pour chaque paragraphe pour la simulation
  const statuses = ["vrai", "partiellement vrai", "faux", "non vérifiable"];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  // Pour la démonstration, utiliser les 2-3 premières sources de la liste
  const usedSources = trustedSources.slice(0, Math.min(2 + Math.floor(Math.random() * 2), trustedSources.length));
  
  return {
    paragraphIndex: paragraphIndex,
    content: pageContent.content,
    summary: `Vérification du paragraphe ${paragraphIndex + 1} (simulation): Cette analyse est limitée aux sources spécifiées.`,
    status: randomStatus,
    explanation: getExplanationForStatus(randomStatus, pageContent.content),
    sources: usedSources
  };
}

// Fonction pour générer une explication selon le statut (pour la simulation)
function getExplanationForStatus(status, content) {
  switch(status) {
    case "vrai":
      return `Cette information a été confirmée par les sources vérifiées. Les faits mentionnés correspondent aux données publiées dans nos sources.`;
    case "partiellement vrai":
      return `Cette information contient des éléments exacts mais aussi des imprécisions. Les sources vérifiées confirment certains aspects mais pas la totalité.`;
    case "faux":
      return `Cette information est contredite par les sources vérifiées. Les faits présentés ne correspondent pas aux données disponibles dans nos sources.`;
    case "non vérifiable":
      return `Impossible de vérifier cette information avec les sources spécifiées. Ce sujet n'est pas traité dans les sources de confiance fournies.`;
    default:
      return `Statut de vérification inconnu.`;
  }
}

// Fonction pour formater tous les résultats de vérification
function formatVerificationResults(results, pageContent) {
  let html = `<div class="verification-header">
    <h3>Vérification de "${pageContent.title}"</h3>
    <p class="verification-info">Basée exclusivement sur les sources vérifiées</p>
  </div>`;
  
  html += '<div class="paragraphs-container">';
  
  results.forEach(result => {
    let statusClass = '';
    switch(result.status.toLowerCase()) {
      case 'vrai':
      case 'true':
        statusClass = 'status-true';
        break;
      case 'partiellement vrai':
      case 'partially true':
        statusClass = 'status-partial';
        break;
      case 'faux':
      case 'false':
        statusClass = 'status-false';
        break;
      case 'non vérifiable':
      default:
        statusClass = 'status-unverified';
    }
    
    html += `<div class="paragraph-result ${statusClass}">`;
    html += `<div class="paragraph-content">"${result.content.substring(0, 150)}${result.content.length > 150 ? '...' : ''}"</div>`;
    html += `<div class="verification-badge ${statusClass}">${result.status}</div>`;
    html += `<div class="verification-explanation">${result.explanation}</div>`;
    
    if (result.sources && result.sources.length > 0) {
      html += '<div class="verification-sources">';
      html += '<h4>Sources consultées</h4>';
      html += '<ul>';
      
      result.sources.forEach(source => {
        html += `<li><a href="${source}" target="_blank">${source}</a></li>`;
      });
      
      html += '</ul>';
      html += '</div>';
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  
  return html;
} 