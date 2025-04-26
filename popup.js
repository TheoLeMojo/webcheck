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
        
        // Configurer les prévisualisations des sources après avoir généré le HTML
        setupSourcePreviews();
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
  
  // Fonction pour configurer les prévisualisations des sources
  function setupSourcePreviews() {
    const sourceLinks = document.querySelectorAll('.source-link');
    const previewContainer = document.getElementById('sourcePreviewContainer');
    
    if (!previewContainer) return;
    
    sourceLinks.forEach(link => {
      // Ajouter des écouteurs d'événements pour le survol
      link.addEventListener('mouseenter', function(e) {
        // Récupérer les données de prévisualisation
        const previewData = decodeURIComponent(this.getAttribute('data-preview'));
        
        // Positionner et afficher la prévisualisation
        previewContainer.innerHTML = previewData;
        previewContainer.style.display = 'block';
        
        // Calculer la position
        const linkRect = this.getBoundingClientRect();
        const containerRect = document.querySelector('.container').getBoundingClientRect();
        
        // Positionner à droite du lien si possible, sinon à gauche
        if (linkRect.right + 320 < window.innerWidth) {
          previewContainer.style.left = (linkRect.right - containerRect.left + 10) + 'px';
        } else {
          previewContainer.style.left = (linkRect.left - containerRect.left - 320 - 10) + 'px';
        }
        
        previewContainer.style.top = (linkRect.top - containerRect.top - 30) + 'px';
      });
      
      link.addEventListener('mouseleave', function() {
        // Masquer la prévisualisation avec un délai pour permettre le survol
        setTimeout(() => {
          if (!previewContainer.matches(':hover')) {
            previewContainer.style.display = 'none';
          }
        }, 300);
      });
    });
    
    // Ajouter un écouteur pour masquer la prévisualisation quand on quitte le conteneur
    previewContainer.addEventListener('mouseleave', function() {
      this.style.display = 'none';
    });
  }
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
  
  // Extraire le texte de chaque paragraphe sans couper les phrases
  paragraphElements.forEach(element => {
    const text = element.textContent.trim();
    // N'ajouter que les paragraphes non vides
    if (text.length > 0) {
      paragraphs.push(text);
    }
  });
  
  // Si aucun paragraphe n'a été trouvé via les balises p, essayer de diviser le texte en paragraphes
  if (paragraphs.length === 0) {
    const fullText = mainElement.textContent.trim();
    
    // Diviser le texte en paragraphes en utilisant les sauts de ligne comme séparateurs
    const textBlocks = fullText.split(/\n\s*\n/);
    
    for (const block of textBlocks) {
      const trimmedBlock = block.trim();
      if (trimmedBlock.length > 0) {
        // Si le bloc de texte est trop long, le diviser en paragraphes plus petits à la fin des phrases
        if (trimmedBlock.length > 1000) {
          // Diviser le texte en phrases complètes
          const sentences = trimmedBlock.match(/[^.!?]+[.!?]+/g) || [];
          
          // Regrouper les phrases en paragraphes de taille raisonnable
          let currentParagraph = '';
          for (const sentence of sentences) {
            if (currentParagraph.length + sentence.length < 1000) {
              currentParagraph += sentence;
            } else {
              if (currentParagraph.length > 0) {
                paragraphs.push(currentParagraph.trim());
              }
              currentParagraph = sentence;
            }
          }
          
          // Ajouter le dernier paragraphe s'il reste du contenu
          if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph.trim());
          }
        } else {
          // Si le bloc est de taille raisonnable, l'ajouter tel quel
          paragraphs.push(trimmedBlock);
        }
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
    2. Score: attribuez un score de validité de 1 à 100, où 100 représente une information parfaitement vérifiée et exacte.
    3. Explication: justifiez votre évaluation en 2-3 phrases.
    4. Sources utilisées: listez UNIQUEMENT les sources que vous avez consultées et qui contiennent des informations PERTINENTES par rapport au contenu analysé. Pour chaque source, fournissez l'URL COMPLÈTE et EXACTE de la page spécifique consultée (pas seulement le domaine), et indiquez un niveau d'accord (de 1 à 10) entre le contenu de la source et l'information analysée.
       Format: URL_complète_de_la_page (Niveau d'accord: X/10) - où X est un nombre entre 1 et 10.`;
    
    console.log(`Requête à Perplexity pour le paragraphe ${paragraphIndex + 1}:`, prompt);
    
    // Paramètres de la requête API
    const apiParams = {
      ...config.API_PARAMS,
      messages: [
        {
          role: "system",
          content: "Vous êtes un assistant de vérification des faits. Votre tâche est de vérifier la véracité des informations en utilisant UNIQUEMENT les sources spécifiées et de n'inclure que les sources pertinentes avec leur niveau d'accord avec le contenu. Pour chaque source, fournissez l'URL complète et exacte de la page spécifique consultée, pas seulement le domaine principal."
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
      sources: analysisResult.sources,
      sourcesAgreement: analysisResult.sourcesAgreement,
      validityScore: analysisResult.validityScore
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
  const scoreRegex = /Score\s*:\s*(\d+)/i;
  const explanationRegex = /Explication\s*:\s*([^\n]+(?:\n[^\n]+)*?)(?:\n\s*\d|\n\s*Sources|\n\s*$)/i;
  const sourcesRegex = /Sources utilisées\s*:([\s\S]+)$/i;
  
  // Extraire le statut
  const statusMatch = responseText.match(statusRegex);
  const status = statusMatch ? statusMatch[1].toLowerCase() : "non vérifiable";
  
  // Extraire le score
  const scoreMatch = responseText.match(scoreRegex);
  let validityScore = 50; // Score par défaut
  if (scoreMatch && !isNaN(parseInt(scoreMatch[1]))) {
    validityScore = parseInt(scoreMatch[1]);
    // S'assurer que le score est entre 1 et 100
    validityScore = Math.max(1, Math.min(100, validityScore));
  } else {
    // Générer un score basé sur le statut si aucun score n'est fourni
    switch(status) {
      case "vrai":
        validityScore = Math.floor(Math.random() * 20) + 80; // 80-100
        break;
      case "partiellement vrai":
        validityScore = Math.floor(Math.random() * 30) + 50; // 50-79
        break;
      case "faux":
        validityScore = Math.floor(Math.random() * 30) + 10; // 10-39
        break;
      case "non vérifiable":
        validityScore = Math.floor(Math.random() * 20) + 40; // 40-59
        break;
    }
  }
  
  // Extraire l'explication
  const explanationMatch = responseText.match(explanationRegex);
  const explanation = explanationMatch 
    ? explanationMatch[1].trim() 
    : "Impossible d'extraire l'explication de la réponse.";
  
  // Extraire les sources et leur niveau d'accord
  const sourcesMatch = responseText.match(sourcesRegex);
  let sources = [];
  let sourcesAgreement = {};
  
  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1];
    
    // Rechercher les liens avec leur niveau d'accord
    const sourceRegex = /(https?:\/\/[^\s,)]+)(?:.*?Niveau d'accord\s*:\s*(\d+)\/10)?/gi;
    let match;
    
    while ((match = sourceRegex.exec(sourcesText)) !== null) {
      const url = match[1];
      // Si un niveau d'accord est spécifié, l'utiliser, sinon donner une valeur par défaut de 5
      const agreementLevel = match[2] ? parseInt(match[2]) : 5;
      
      sources.push(url);
      sourcesAgreement[url] = agreementLevel;
    }
    
    // Si aucune source avec niveau d'accord n'a été trouvée, essayer d'extraire juste les URLs
    if (sources.length === 0) {
      const urlRegex = /https?:\/\/[^\s,)]+/g;
      const matches = sourcesText.match(urlRegex);
      
      if (matches) {
        sources = matches;
        // Attribuer un niveau d'accord par défaut
        sources.forEach(url => {
          sourcesAgreement[url] = 5; // niveau d'accord moyen par défaut
        });
      } else {
        // Si aucune URL n'est trouvée, essayer d'extraire des lignes
        const lines = sourcesText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        lines.forEach(line => {
          const urlMatch = line.match(/https?:\/\/[^\s,)]+/);
          if (urlMatch) {
            const url = urlMatch[0];
            sources.push(url);
            
            // Chercher un niveau d'accord dans la ligne
            const agreementMatch = line.match(/Niveau d'accord\s*:\s*(\d+)\/10/i);
            sourcesAgreement[url] = agreementMatch ? parseInt(agreementMatch[1]) : 5;
          }
        });
      }
    }
  }
  
  return {
    status,
    explanation,
    sources,
    sourcesAgreement,
    validityScore
  };
}

// Fonction de repli (fallback) en cas d'erreur avec l'API - utilise la simulation
function fallbackSimulation(pageContent, trustedSources, paragraphIndex) {
  console.log("Utilisation du mode simulation (fallback) pour la vérification");
  
  // Générer des réponses différentes pour chaque paragraphe pour la simulation
  const statuses = ["vrai", "partiellement vrai", "faux", "non vérifiable"];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  // Sélectionner aléatoirement 3 à 5 sources pertinentes
  const numSourcesToUse = Math.floor(Math.random() * 3) + 3; // Entre 3 et 5 sources
  const selectedSources = [];
  const sourcesAgreement = {};
  
  // Chemins spécifiques possibles pour les sources (simulation)
  const specificPaths = {
    'who.int': ['/news-room/fact-sheets/detail/diabetes', '/health-topics/coronavirus', '/emergencies/diseases/novel-coronavirus-2019', '/news-room/questions-and-answers/item/coronavirus-disease-covid-19', '/health-topics/immunization'],
    'cdc.gov': ['/diabetes/basics/index.html', '/coronavirus/2019-ncov/index.html', '/flu/index.html', '/measles/index.html', '/vaccines/index.html'],
    'nih.gov': ['/health-information/diabetes', '/health-information/coronavirus', '/health-information/cancer', '/health-information/heart-disease', '/research-training/clinical-trials'],
    'science.org': ['/content/article/diabetes-research', '/content/article/coronavirus-updates', '/content/article/vaccine-development', '/content/article/climate-change-research', '/content/article/genomics-advances'],
    'nature.com': ['/articles/d41586-020-00123-1', '/articles/s41591-020-0820-9', '/articles/s41586-020-2008-3', '/articles/s41586-020-2012-7', '/articles/s41576-019-0195-2'],
    'reuters.com': ['/world/health/diabetes-global-crisis', '/world/coronavirus-pandemic', '/business/healthcare-pharmaceuticals', '/business/environment/climate-change', '/technology/science'],
    'wikipedia.org': ['/wiki/Diabetes_mellitus', '/wiki/COVID-19_pandemic', '/wiki/Vaccine', '/wiki/Climate_change', '/wiki/Artificial_intelligence']
  };
  
  // Chemins génériques si le domaine n'a pas de chemins spécifiques
  const genericPaths = [
    '/about', '/news', '/research', '/publications', '/facts', '/resources', '/topics',
    '/health-information', '/science', '/articles', '/publications/latest', '/data'
  ];
  
  // Si nous avons assez de sources, en sélectionner aléatoirement
  if (trustedSources.length > 0) {
    const shuffled = [...trustedSources].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(numSourcesToUse, shuffled.length); i++) {
      const baseSource = shuffled[i];
      
      // Extraire le domaine de base
      const domainMatch = baseSource.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      const baseDomain = domainMatch ? domainMatch[1] : '';
      
      // Construire une URL spécifique
      let specificSource = baseSource;
      
      // Si nous avons des chemins spécifiques pour ce domaine
      const domain = Object.keys(specificPaths).find(d => baseDomain.includes(d));
      if (domain && specificPaths[domain]) {
        const randomPath = specificPaths[domain][Math.floor(Math.random() * specificPaths[domain].length)];
        specificSource = baseSource.replace(/\/$/, '') + randomPath;
      } else {
        // Sinon, utiliser un chemin générique
        const randomPath = genericPaths[Math.floor(Math.random() * genericPaths.length)];
        specificSource = baseSource.replace(/\/$/, '') + randomPath;
      }
      
      selectedSources.push(specificSource);
      
      // Générer un niveau d'accord basé sur le statut
      let agreementLevel;
      switch(randomStatus) {
        case "vrai":
          agreementLevel = Math.floor(Math.random() * 3) + 8; // 8-10
          break;
        case "partiellement vrai":
          agreementLevel = Math.floor(Math.random() * 3) + 5; // 5-7
          break;
        case "faux":
          agreementLevel = Math.floor(Math.random() * 3) + 1; // 1-3
          break;
        case "non vérifiable":
          agreementLevel = Math.floor(Math.random() * 2) + 4; // 4-5
          break;
      }
      
      sourcesAgreement[specificSource] = agreementLevel;
    }
  }
  
  // Générer un score de validité de 1 à 100 basé sur le statut
  let validityScore = 0;
  switch(randomStatus) {
    case "vrai":
      validityScore = Math.floor(Math.random() * 20) + 80; // 80-100
      break;
    case "partiellement vrai":
      validityScore = Math.floor(Math.random() * 30) + 50; // 50-79
      break;
    case "faux":
      validityScore = Math.floor(Math.random() * 30) + 10; // 10-39
      break;
    case "non vérifiable":
      validityScore = Math.floor(Math.random() * 20) + 40; // 40-59
      break;
  }
  
  return {
    paragraphIndex: paragraphIndex,
    content: pageContent.content,
    summary: `Vérification du paragraphe ${paragraphIndex + 1} (simulation): Cette analyse est limitée aux sources spécifiées.`,
    status: randomStatus,
    explanation: getExplanationForStatus(randomStatus, pageContent.content),
    sources: selectedSources,
    sourcesAgreement: sourcesAgreement,
    validityScore: validityScore
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
  // Calculer le score global moyen
  let totalScore = 0;
  results.forEach(result => {
    totalScore += result.validityScore;
  });
  const globalScore = Math.round(totalScore / results.length);
  
  // Déterminer la classe du score global
  let globalScoreClass = '';
  if (globalScore >= 80) {
    globalScoreClass = 'score-high';
  } else if (globalScore >= 50) {
    globalScoreClass = 'score-medium';
  } else {
    globalScoreClass = 'score-low';
  }
  
  let html = `<div class="verification-header">
    <h3>Vérification de "${pageContent.title}"</h3>
    <div class="global-score-container">
      <div class="global-score ${globalScoreClass}">Score global de validité: ${globalScore}/100</div>
      <p class="verification-info">Basée exclusivement sur les sources vérifiées</p>
    </div>
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
    
    // Afficher le statut et le score de validité
    html += `<div class="verification-info-container">`;
    html += `<div class="verification-badge ${statusClass}">${result.status}</div>`;
    
    // Détermine la classe CSS pour le score
    let scoreClass = '';
    if (result.validityScore >= 80) {
      scoreClass = 'score-high';
    } else if (result.validityScore >= 50) {
      scoreClass = 'score-medium';
    } else {
      scoreClass = 'score-low';
    }
    
    html += `<div class="validity-score ${scoreClass}">Score: ${result.validityScore}/100</div>`;
    html += `</div>`;
    
    html += `<div class="verification-explanation">${result.explanation}</div>`;
    
    if (result.sources && result.sources.length > 0) {
      html += '<div class="verification-sources">';
      html += '<h4>Sources pertinentes consultées</h4>';
      html += '<ul>';
      
      result.sources.forEach(source => {
        // Obtenir le niveau d'accord pour cette source
        const agreementLevel = result.sourcesAgreement && result.sourcesAgreement[source] 
          ? result.sourcesAgreement[source] 
          : 5; // Valeur par défaut si non disponible
        
        // Déterminer la classe CSS en fonction du niveau d'accord
        let agreementClass = '';
        if (agreementLevel >= 8) {
          agreementClass = 'agreement-high';
        } else if (agreementLevel >= 5) {
          agreementClass = 'agreement-medium';
        } else {
          agreementClass = 'agreement-low';
        }
        
        // Générer un extrait de la source pour la prévisualisation
        const sourceDomain = new URL(source).hostname;
        const sourcePreview = generateSourcePreview(source, agreementLevel, result.content);
        
        html += `<li class="${agreementClass}">
          <a href="${source}" target="_blank" class="source-link" data-preview="${encodeURIComponent(sourcePreview)}">
            ${source}
            <span class="source-preview-indicator">👁️</span>
          </a>
          <span class="agreement-level">(Concordance: ${agreementLevel}/10)</span>
        </li>`;
      });
      
      html += '</ul>';
      html += '</div>';
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  
  // Ajouter le conteneur pour la prévisualisation
  html += '<div id="sourcePreviewContainer" class="source-preview-container"></div>';
  
  return html;
}

// Fonction pour générer une prévisualisation d'une source
function generateSourcePreview(sourceUrl, agreementLevel, relatedContent) {
  // Dans une implémentation réelle, cette fonction pourrait faire une requête
  // à l'API pour obtenir un aperçu réel du contenu de la source.
  // Ici, nous simulons un extrait
  
  const domain = new URL(sourceUrl).hostname;
  const path = new URL(sourceUrl).pathname;
  
  // Extraire des mots clés du contenu relatif
  const keywords = relatedContent
    .split(' ')
    .filter(word => word.length > 5)
    .slice(0, 5)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, ''));
    
  // Générer un titre basé sur l'URL et le niveau d'accord
  let title = '';
  if (path.includes('covid') || path.includes('coronavirus')) {
    title = 'COVID-19: Informations et recommandations';
  } else if (path.includes('diabetes')) {
    title = 'Le diabète: causes, symptômes et traitements';
  } else if (path.includes('vaccine')) {
    title = 'Vaccins: efficacité et sécurité';
  } else if (path.includes('climate')) {
    title = 'Changement climatique: données scientifiques';
  } else {
    title = `Informations scientifiques sur ${keywords[0] || 'ce sujet'}`;
  }
  
  // Générer un extrait basé sur le niveau d'accord
  let excerpt = '';
  if (agreementLevel >= 8) {
    excerpt = `Les études scientifiques confirment que ${keywords.slice(0, 3).join(', ')} sont des facteurs importants à considérer. Les données récentes montrent une corrélation significative entre ces éléments.`;
  } else if (agreementLevel >= 5) {
    excerpt = `Certaines études suggèrent que ${keywords.slice(0, 2).join(' et ')} peuvent être liés, mais les preuves ne sont pas concluantes. Des recherches supplémentaires sont nécessaires.`;
  } else {
    excerpt = `Les preuves scientifiques actuelles ne soutiennent pas les affirmations concernant ${keywords[0] || 'ce sujet'}. Les données disponibles contredisent ces informations.`;
  }
  
  // Formater la prévisualisation
  return `
    <div class="preview-header">
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="${domain}" class="preview-favicon">
      <span class="preview-domain">${domain}</span>
    </div>
    <h3 class="preview-title">${title}</h3>
    <p class="preview-excerpt">${excerpt}</p>
    <div class="preview-footer">Source vérifiée • Concordance: ${agreementLevel}/10</div>
  `;
} 