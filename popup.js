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
      
      // Afficher le statut
      statusDiv.textContent = 'Envoi à Perplexity pour vérification...';
      
      // Envoyer à l'API de Perplexity
      const verificationResult = await checkWithPerplexity(pageContent, allSources, tab.url);
      
      // Afficher le résultat
      resultDiv.innerHTML = formatVerificationResult(verificationResult);
      
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
  // Récupérer le contenu textuel principal de la page
  // Cette fonction est exécutée dans le contexte de la page web
  const getVisibleText = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return '';
    }
    
    let text = '';
    for (let child of node.childNodes) {
      text += ' ' + getVisibleText(child);
    }
    
    return text.trim();
  };

  // Extraire le titre de la page
  const title = document.title;
  
  // Récupérer le contenu principal
  let mainContent = '';
  
  // Essayer d'identifier le contenu principal (article, section principale, etc.)
  const mainElements = document.querySelectorAll('article, main, .content, .main, #content, #main');
  
  if (mainElements.length > 0) {
    // Utiliser le premier élément principal trouvé
    mainContent = getVisibleText(mainElements[0]);
  } else {
    // Sinon, utiliser le body entier
    mainContent = getVisibleText(document.body);
  }
  
  // Limiter la taille du contenu pour éviter des requêtes trop volumineuses
  const maxLength = 5000;
  if (mainContent.length > maxLength) {
    mainContent = mainContent.substring(0, maxLength) + '...';
  }
  
  // Combiner les informations
  return {
    title: title,
    content: mainContent,
    url: window.location.href
  };
}

// Fonction pour envoyer les données à Perplexity et obtenir une vérification
async function checkWithPerplexity(pageContent, trustedSources, pageUrl) {
  // Dans une implémentation réelle, vous devriez utiliser l'API de Perplexity
  // Mais comme ce n'est pas publiquement documenté, voici comment on pourrait procéder:
  
  // 1. Option: Utiliser leur API si vous avez un accès
  // 2. Option: Créer un backend qui interagit avec Perplexity via des méthodes alternatives
  
  // Pour cette démonstration, nous allons simuler une réponse
  
  // Construire la liste des sources à utiliser en priorité
  const sourcesList = trustedSources.length > 0 
    ? 'Sources de confiance à utiliser en priorité: ' + trustedSources.join(', ')
    : 'Utilisez des sources fiables pour la vérification.';
  
  // Créer une requête qui inclut le contenu de la page et les sources de confiance
  const prompt = `Vérifiez la véracité des informations suivantes provenant de ${pageUrl}:
  
  "${pageContent.title}"
  
  Contenu: "${pageContent.content.substring(0, 1000)}..."
  
  ${sourcesList}
  
  Donnez-moi une analyse factuelle, indiquez quelles informations sont vraies, fausses ou non vérifiables, et expliquez pourquoi.`;
  
  console.log("Requête à Perplexity:", prompt);
  
  // Simuler un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simuler une réponse
  // Dans une implémentation réelle, cette partie serait remplacée par un appel API
  return {
    summary: "Cette analyse est simulée car l'API Perplexity n'est pas publiquement accessible. Dans une implémentation réelle, vous devriez utiliser l'API officielle ou un backend personnalisé.",
    verifiedClaims: [
      {
        claim: "Exemple de déclaration extraite de la page",
        status: "vrai",
        explanation: "Cette information a été confirmée par des sources fiables."
      },
      {
        claim: "Autre exemple de déclaration",
        status: "partiellement vrai",
        explanation: "Cette information est partiellement correcte, mais contient des imprécisions."
      }
    ],
    sources: [
      "https://exemple-source-fiable.com/article1",
      "https://autre-source.org/etude"
    ]
  };
}

// Fonction pour formater le résultat de la vérification
function formatVerificationResult(result) {
  let html = '<div class="verification-summary">';
  html += `<p>${result.summary}</p>`;
  html += '</div>';
  
  html += '<div class="verified-claims">';
  html += '<h3>Déclarations vérifiées</h3>';
  
  result.verifiedClaims.forEach(claim => {
    let statusClass = '';
    switch(claim.status.toLowerCase()) {
      case 'vrai':
      case 'true':
        statusClass = 'status-true';
        break;
      case 'faux':
      case 'false':
        statusClass = 'status-false';
        break;
      case 'partiellement vrai':
      case 'partially true':
        statusClass = 'status-partial';
        break;
      default:
        statusClass = 'status-unverified';
    }
    
    html += `<div class="claim ${statusClass}">`;
    html += `<p class="claim-text">"${claim.claim}"</p>`;
    html += `<p class="claim-status">${claim.status}</p>`;
    html += `<p class="claim-explanation">${claim.explanation}</p>`;
    html += '</div>';
  });
  
  html += '</div>';
  
  if (result.sources && result.sources.length > 0) {
    html += '<div class="sources">';
    html += '<h3>Sources utilisées</h3>';
    html += '<ul>';
    
    result.sources.forEach(source => {
      html += `<li><a href="${source}" target="_blank">${source}</a></li>`;
    });
    
    html += '</ul>';
    html += '</div>';
  }
  
  return html;
} 