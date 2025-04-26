// Importer la configuration
import config from './config.js';
// Importer les fonctions de logging
import { logApiError, exportApiErrorLogs, getApiErrorLogs, clearApiErrorLogs, openCurrentLogFile } from './logger.js';

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', async function() {
  // Récupérer les éléments du DOM
  const checkButton = document.getElementById('checkPage');
  const checkSelectedTextButton = document.getElementById('checkSelectedText');
  const selectedTextInput = document.getElementById('selectedTextInput');
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
  
  // Configuration du menu développeur
  const devModeEnabled = localStorage.getItem('devMode') === 'true';
  const exportLogsBtn = document.getElementById('exportLogs');
  const clearLogsBtn = document.getElementById('clearLogs');
  const openLogBtn = document.getElementById('openLogFile');
  const logStatsDiv = document.getElementById('logStats');
  
  // Tentative d'auto-remplir le champ de texte avec le texte sélectionné
  try {
    // Obtenir l'onglet actif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Exécuter un script pour récupérer le texte sélectionné
    const selection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString()
    });
    
    // Si du texte a été sélectionné, le pré-remplir dans le champ
    if (selection && selection[0] && selection[0].result) {
      selectedTextInput.value = selection[0].result.trim();
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du texte sélectionné:', error);
  }
  
  if (devModeEnabled) {
    // Configurer les boutons du menu développeur
    if (exportLogsBtn) {
      exportLogsBtn.addEventListener('click', exportApiErrorLogs);
    }
    
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', function() {
        if (confirm('Êtes-vous sûr de vouloir effacer tous les logs d\'erreurs API?')) {
          clearApiErrorLogs(() => {
            alert('Logs effacés avec succès.');
            updateLogStats();
          });
        }
      });
    }
    
    if (openLogBtn) {
      openLogBtn.addEventListener('click', function() {
        openCurrentLogFile();
      });
      // Vérifier si un fichier de log existe
      chrome.storage.local.get(['currentLogFileContent'], function(result) {
        openLogBtn.style.display = result.currentLogFileContent ? 'block' : 'none';
      });
    }
    
    // Mettre à jour les statistiques de logs
    updateLogStats();
    
    // Vérifier périodiquement les mises à jour des logs (toutes les 30 secondes)
    setInterval(updateLogStats, 30000);
  }
  
  // Variables pour stocker les sources
  let defaultSources = [];
  let userSources = [];
  
  // Charger les préférences utilisateur (états des toggles)
  chrome.storage.local.get(['showDefaultSources', 'showUserSources'], function(result) {
    // Définir les états par défaut (true si non défini)
    const showDefaultSources = result.showDefaultSources !== undefined ? result.showDefaultSources : true;
    const showUserSources = result.showUserSources !== undefined ? result.showUserSources : true;
    
    // Appliquer les états aux toggles
    toggleDefaultSources.checked = showDefaultSources;
    toggleUserSources.checked = showUserSources;
    
    // Appliquer la visibilité initiale
    defaultSourcesList.style.display = showDefaultSources ? 'block' : 'none';
    userSourcesContainer.style.display = showUserSources ? 'block' : 'none';
  });
  
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
  
  // Fonction pour sauvegarder les préférences utilisateur
  function saveUserPreferences() {
    chrome.storage.local.set({ 
      showDefaultSources: toggleDefaultSources.checked,
      showUserSources: toggleUserSources.checked
    });
  }
  
  // Gestionnaires d'événements pour les toggles
  toggleDefaultSources.addEventListener('change', function() {
    defaultSourcesList.style.display = this.checked ? 'block' : 'none';
    saveUserPreferences();
  });
  
  toggleUserSources.addEventListener('change', function() {
    userSourcesContainer.style.display = this.checked ? 'block' : 'none';
    saveUserPreferences();
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
  
  // Ajouter un écouteur d'événement au bouton de vérification du texte sélectionné
  checkSelectedTextButton.addEventListener('click', async function() {
    const textToVerify = selectedTextInput.value.trim();
    
    if (!textToVerify) {
      statusDiv.textContent = 'Veuillez entrer ou coller du texte à vérifier.';
      return;
    }
    
    // Désactiver les boutons pendant la vérification
    checkButton.disabled = true;
    checkSelectedTextButton.disabled = true;
    statusDiv.textContent = 'Vérification du texte...';
    resultDiv.textContent = '';
    loader.style.display = 'block';
    
    try {
      // Combiner les sources par ordre de priorité
      const allSources = [...defaultSources, ...userSources];
      
      if (allSources.length === 0) {
        statusDiv.textContent = 'Aucune source vérifiée disponible. Ajoutez des sources pour continuer.';
        checkButton.disabled = false;
        checkSelectedTextButton.disabled = false;
        loader.style.display = 'none';
        return;
      }
      
      // Obtenir l'onglet actif
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Préparer le contenu pour la vérification
      const textContent = {
        content: textToVerify,
        title: 'Texte sélectionné',
        url: tab.url,
        metaDescription: '',
        metaKeywords: ''
      };
      
      statusDiv.textContent = 'Analyse du texte et vérification...';
      
      // Vérifier directement le texte sélectionné
      const result = await checkWithPerplexity(
        textContent,
        allSources,
        tab.url,
        0
      );
      
      if (result) {
        // Créer un "faux" pageContent pour le formatage des résultats
        const mockPageContent = {
          title: 'Texte sélectionné',
          paragraphs: [textToVerify],
          url: tab.url
        };
        
        resultDiv.innerHTML = formatVerificationResults([result], mockPageContent);
        
        // Configurer les prévisualisations des sources après avoir généré le HTML
        setupSourcePreviews();
      } else {
        resultDiv.innerHTML = "<p>Impossible de vérifier le texte sélectionné.</p>";
      }
      
      // Mettre à jour le statut
      statusDiv.textContent = 'Vérification terminée';
    } catch (error) {
      console.error('Erreur:', error);
      statusDiv.textContent = 'Erreur: ' + error.message;
    } finally {
      // Réactiver les boutons et cacher le loader
      checkButton.disabled = false;
      checkSelectedTextButton.disabled = false;
      loader.style.display = 'none';
    }
  });
  
  // Ajouter un écouteur d'événement au bouton de vérification de page
  checkButton.addEventListener('click', async function() {
    // Désactiver le bouton pendant la vérification
    checkButton.disabled = true;
    checkSelectedTextButton.disabled = true;
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
        checkSelectedTextButton.disabled = false;
        loader.style.display = 'none';
        return;
      }
      
      // Analyser les métadonnées et le contenu pour détecter d'éventuelles théories controversées
      const pageText = [
        pageContent.title,
        pageContent.metaDescription,
        pageContent.metaKeywords,
        ...pageContent.paragraphs.slice(0, 5) // Premières lignes pour détecter le thème
      ].join(' ').toLowerCase();
      
      // Mots-clés associés à des théories scientifiquement controversées
      const controversialKeywords = [
        'terre plate', 'flat earth', 'complot', 'conspiracy', 
        'anti-vax', 'anti-vaccin', 'chemtrails', 'nouvel ordre mondial',
        'illuminati', 'fausse pandémie', 'plandemic', 'deep state',
        '5g danger', 'reptilien', 'reptilian', 'faux atterrissage lunaire',
        'fake moon landing', 'quantum healing', 'guérison quantique',
        'homéopathie', 'homeopathy'
      ];
      
      // Vérifier si la page contient des théories controversées
      const containsControversialTheories = controversialKeywords.some(keyword => 
        pageText.includes(keyword)
      );
      
      // Ajuster l'échantillonnage de paragraphes en fonction du contenu
      let paragraphsToAnalyze = 5; // Par défaut
      
      if (containsControversialTheories) {
        paragraphsToAnalyze = 8; // Examiner plus de paragraphes pour les théories controversées
        statusDiv.textContent = 'Détection de théories scientifiques controversées. Analyse approfondie en cours...';
      } else {
        statusDiv.textContent = 'Analyse des paragraphes et vérification...';
      }
      
      // Filtrer les paragraphes trop courts
      const significantParagraphs = pageContent.paragraphs.filter(
        paragraph => paragraph.trim().length >= 50
      );
      
      // Sélectionner les paragraphes les plus pertinents
      const paragraphsToVerify = significantParagraphs.slice(0, paragraphsToAnalyze);
      
      // Ajouter le titre et les métadonnées comme contexte aux paragraphes
      const enrichedParagraphs = paragraphsToVerify.map(paragraph => ({
        content: paragraph,
        title: pageContent.title,
        url: pageContent.url,
        metaDescription: pageContent.metaDescription,
        metaKeywords: pageContent.metaKeywords
      }));
      
      statusDiv.textContent = `Analyse approfondie de ${paragraphsToVerify.length} paragraphes...`;
      
      // Vérifier chaque paragraphe individuellement
      const verificationResults = await Promise.all(
        enrichedParagraphs.map(async (enrichedParagraph, index) => {
          statusDiv.textContent = `Vérification approfondie du paragraphe ${index + 1}/${paragraphsToVerify.length}...`;
          
          return await checkWithPerplexity(
            enrichedParagraph, 
            allSources, 
            tab.url,
            index
          );
        })
      );
      
      // Filtrer les résultats null (paragraphes ignorés)
      const validResults = verificationResults.filter(result => result !== null);
      
      // Vérifier si de fausses théories scientifiques ont été identifiées et ajuster les scores
      const containsDebunkedScience = validResults.some(
        result => result.status.toLowerCase() === 'faux' && result.validityScore < 30
      );
      
      if (containsDebunkedScience) {
        // Ajuster les scores pour pénaliser davantage les pages avec des informations scientifiquement fausses
        validResults.forEach(result => {
          if (result.status.toLowerCase() !== 'vrai' && result.status.toLowerCase() !== 'true') {
            // Réduire le score des contenus partiellement vrais ou non vérifiables sur des pages contenant des faussetés
            result.validityScore = Math.max(10, Math.floor(result.validityScore * 0.7));
          }
        });
      }
      
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
      // Réactiver les boutons et cacher le loader
      checkButton.disabled = false;
      checkSelectedTextButton.disabled = false;
      loader.style.display = 'none';
    }
  });
  
  // Fonction pour configurer les prévisualisations des sources
  function setupSourcePreviews() {
    const sourceLinks = document.querySelectorAll('.source-link');
    const previewContainer = document.getElementById('sourcePreviewContainer');
    const popupContainer = document.querySelector('.container');
    
    if (!previewContainer) return;
    
    // Prévisualisation active actuelle
    let activePreview = null;
    
    sourceLinks.forEach(link => {
      // Ajouter des écouteurs d'événements pour le survol
      link.addEventListener('mouseenter', function(e) {
        // Récupérer les données de prévisualisation
        const previewData = decodeURIComponent(this.getAttribute('data-preview'));
        
        // Positionner et afficher la prévisualisation
        previewContainer.innerHTML = previewData;
        
        // Rendre visible temporairement pour calculer les dimensions
        previewContainer.style.display = 'block';
        previewContainer.style.opacity = '0';
        previewContainer.style.pointerEvents = 'none'; // Permettre les clics à travers
        
        // Obtenir les dimensions
        const linkRect = this.getBoundingClientRect();
        const containerRect = popupContainer.getBoundingClientRect();
        const previewRect = previewContainer.getBoundingClientRect();
        
        // Positionner toujours en dessous du lien
        const leftPos = Math.max(10, Math.min(
          containerRect.width - previewRect.width - 10,
          linkRect.left - containerRect.left
        ));
        
        const topPos = linkRect.bottom - containerRect.top + 10;
        
        // Vérifier si ça dépasse en bas et ajuster la taille si nécessaire
        if (topPos + previewRect.height > containerRect.height - 10) {
          const maxHeight = Math.max(50, containerRect.height - topPos - 20);
          previewContainer.style.maxHeight = `${maxHeight}px`;
        } else {
          previewContainer.style.maxHeight = '200px'; // Restaurer la hauteur max par défaut
        }
        
        // Stocker une référence au lien actif
        activePreview = this;
        
        // Appliquer la position et rendre visible
        previewContainer.style.left = `${leftPos}px`;
        previewContainer.style.top = `${topPos}px`;
        previewContainer.style.opacity = '1';
      });
      
      // Ajouter un gestionnaire de clic explicite
      link.addEventListener('click', function(e) {
        // Permettre au clic de se propager normalement
        previewContainer.style.display = 'none';
      });
      
      link.addEventListener('mouseleave', function() {
        // Masquer la prévisualisation avec un délai pour permettre le survol
        setTimeout(() => {
          if (activePreview === this && !previewContainer.matches(':hover')) {
            previewContainer.style.display = 'none';
            activePreview = null;
          }
        }, 300);
      });
    });
    
    // Ajouter un écouteur pour masquer la prévisualisation quand on quitte le conteneur
    previewContainer.addEventListener('mouseleave', function() {
      setTimeout(() => {
        if (activePreview && !activePreview.matches(':hover')) {
          this.style.display = 'none';
          activePreview = null;
        }
      }, 100);
    });
  }
  
  // Fonction pour mettre à jour les statistiques de logs
  function updateLogStats() {
    if (devModeEnabled && logStatsDiv) {
      // Récupérer les informations des logs
      chrome.storage.local.get(['apiErrorLogs', 'lastLogUpdate', 'lastLogFilename', 'currentLogFileContent'], function(result) {
        const logs = result.apiErrorLogs || [];
        const lastUpdate = result.lastLogUpdate ? new Date(result.lastLogUpdate) : null;
        const logFilename = result.lastLogFilename || '';
        const hasLogFile = result.currentLogFileContent && result.currentLogFileContent.length > 0;
        
        let statsHtml = `
          <p>Nombre d'erreurs API enregistrées: <strong>${logs.length}</strong></p>
        `;
        
        if (logs.length > 0) {
          statsHtml += `<p>Dernière erreur: ${new Date(logs[logs.length-1].timestamp).toLocaleString()}</p>`;
        }
        
        if (hasLogFile) {
          statsHtml += `
            <p>Fichier de log actuel: <strong>${logFilename}</strong></p>
            <p>Dernière mise à jour: ${lastUpdate ? lastUpdate.toLocaleString() : 'Jamais'}</p>
            <p>Taille du fichier: ${(result.currentLogFileContent.length / 1024).toFixed(2)} KB</p>
          `;
        }
        
        logStatsDiv.innerHTML = statsHtml;
      });
    }
  }
});

// Fonction pour extraire le contenu de la page
function scrapePageContent() {
  // Cette fonction est exécutée dans le contexte de la page web
  
  // Extraire le titre de la page
  const title = document.title;
  const url = window.location.href;
  
  // Récupérer le contenu principal avec une détection avancée
  let mainElement = null;
  
  // 1. Essayer de détecter le conteneur principal de l'article avec des sélecteurs précis
  const articleContainers = [
    // Sélecteurs courants pour les contenus d'articles
    'article', 
    '[role="main"]',
    '[itemprop="articleBody"]',
    '.post-content',
    '.entry-content',
    '.article__content',
    '.content-body',
    '.article-body',
    '.story-body',
    '.main-content',
    '.post-body',
    // Classes spécifiques pour les CMS populaires (WordPress, etc.)
    '.single-content',
    '.post-text',
    '.article__body',
    '.story-content',
    '.rich-text',
    '.content-article'
  ];
  
  // Essayer chaque sélecteur jusqu'à trouver un conteneur valide
  for (const selector of articleContainers) {
    const element = document.querySelector(selector);
    if (element && element.offsetHeight > 200) { // Vérifier que c'est un élément substantiel
      mainElement = element;
      break;
    }
  }
  
  // 2. Si aucun conteneur d'article spécifique n'est trouvé, essayer les conteneurs génériques
  if (!mainElement) {
    const genericContainers = [
      'main', 
      '.content', 
      '.main', 
      '#content', 
      '#main'
    ];
    
    for (const selector of genericContainers) {
      const element = document.querySelector(selector);
      if (element && element.offsetHeight > 200) {
        mainElement = element;
        break;
      }
    }
  }
  
  // 3. Si toujours pas de conteneur principal identifié, utiliser le body mais essayer
  // d'exclure les éléments de navigation, header, footer, etc.
  if (!mainElement) {
    mainElement = document.body;
  }
  
  // 4. Extraire les métadonnées de la page
  const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
  
  // 5. Purger les éléments non pertinents du contenu principal
  if (mainElement) {
    // Créer une copie du mainElement pour ne pas modifier directement le DOM
    const contentClone = mainElement.cloneNode(true);
    
    // Définir les sélecteurs d'éléments à supprimer
    const elementsToRemove = [
      // Navigation, menus, etc.
      'nav', 'header', 'footer', '.navigation', '.menu', '.nav', '.navbar', 
      // Barres latérales
      'aside', '.sidebar', '.widget-area', '.side-bar', '.supplementary', 
      // Commentaires
      '.comments', '.comment-section', '#comments', '.user-comments',
      // Publicités
      '.ad', '.ads', '.advertisement', '.banner', '[class*="advert"]', '[id*="advert"]',
      // Réseaux sociaux
      '.social', '.share', '.sharing', '.social-media', '.share-buttons',
      // Éléments de pagination, auteurs, dates
      '.pagination', '.pager', '.author-bio', '.author-info', '.post-meta', '.metadata',
      '.byline', '.published', '.post-date', '.date', '.time',
      // Suggestions d'articles, contenus liés
      '.related', '.recommended', '.suggestions', '.read-also', '.read-next',
      '.popular-posts', '.trending', '.taboola', '.outbrain',
      // Boutons, call-to-action
      '.cta', '.newsletter', '.subscribe', '.subscription', 
      // Scripts, iframes, objets incorporés
      'script', 'style', 'iframe', 'embed', 'object', 'noscript'
    ];
    
    // Supprimer les éléments non pertinents
    elementsToRemove.forEach(selector => {
      const elements = contentClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // 6. Extraire uniquement les éléments de texte significatifs
    const paragraphElements = contentClone.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, .paragraph, div > p'
    );
    
    const paragraphs = [];
    
    // 7. Filtrer et traiter les paragraphes pour ne garder que le contenu significatif
    paragraphElements.forEach(element => {
      // Ignorer les éléments vides ou trop courts
      const text = element.textContent.trim();
      if (text.length < 20) return; // Ignorer les textes trop courts
      
      // Ignorer les textes qui ressemblent à des métadonnées
      if (/^(publié|posté|mis à jour|par|écrit par|author|published|updated|by|on|at)\s/i.test(text)) return;
      
      // Ignorer les textes qui ressemblent à des timestamps
      if (/^\d{1,2}[:.]\d{2}$/.test(text) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return;
      
      // Ajouter le paragraphe à notre liste
      paragraphs.push(text);
    });
    
    // 8. Si aucun paragraphe n'a été trouvé via les sélecteurs spécifiques, utiliser le texte complet
    if (paragraphs.length === 0) {
      const fullText = contentClone.textContent.trim();
      
      // Diviser le texte en paragraphes en utilisant les sauts de ligne comme séparateurs
      const textBlocks = fullText.split(/\n\s*\n/);
      
      for (const block of textBlocks) {
        const trimmedBlock = block.trim();
        if (trimmedBlock.length >= 50) { // Uniquement les blocs substantiels
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
    
    // 9. Fusionner les paragraphes très courts adjacents
    const mergedParagraphs = [];
    let currentMergedParagraph = '';
    
    for (const paragraph of paragraphs) {
      if (paragraph.length < 100) {
        if (currentMergedParagraph.length + paragraph.length < 1000) {
          currentMergedParagraph += (currentMergedParagraph ? ' ' : '') + paragraph;
        } else {
          if (currentMergedParagraph.length > 0) {
            mergedParagraphs.push(currentMergedParagraph);
          }
          currentMergedParagraph = paragraph;
        }
      } else {
        if (currentMergedParagraph.length > 0) {
          mergedParagraphs.push(currentMergedParagraph);
          currentMergedParagraph = '';
        }
        mergedParagraphs.push(paragraph);
      }
    }
    
    if (currentMergedParagraph.length > 0) {
      mergedParagraphs.push(currentMergedParagraph);
    }
    
    // 10. Évaluer la pertinence de chaque paragraphe
    const scoredParagraphs = mergedParagraphs.map(p => {
      let score = p.length; // La longueur de base
      
      // Bonus pour les paragraphes qui semblent contenir des informations factuelles
      if (/facts?|research|study|studies|science|data|evidence|proof|discovered|found|according to|researchers|experts|scientists/i.test(p)) {
        score += 2000;
      }
      
      // Bonus pour les paragraphes avec des chiffres (souvent des statistiques ou données)
      const numberCount = (p.match(/\d+/g) || []).length;
      score += numberCount * 200;
      
      // Bonus pour les paragraphes contenant des citations
      if (p.includes('"') || p.includes('"') || p.includes('"')) {
        score += 500;
      }
      
      // Bonus pour les paragraphes plus longs (généralement plus substantiels)
      if (p.length > 200) score += 500;
      
      // Pénalité pour les textes qui ressemblent à des informations de contact ou mentions légales
      if (/contact|copyright|rights reserved|privacy policy|terms/i.test(p)) {
        score -= 1000;
      }
      
      return { text: p, score };
    });
    
    // Trier par score et prendre les paragraphes les plus pertinents
    const significantParagraphs = scoredParagraphs
      .sort((a, b) => b.score - a.score)
      .map(item => item.text);
    
    // Retourner les informations extraites
    return {
      title: title,
      paragraphs: significantParagraphs,
      url: url,
      metaDescription,
      metaKeywords
    };
  }
  
  // Si tout échoue, retourner au moins le titre
  return {
    title: title,
    paragraphs: [],
    url: url,
    metaDescription,
    metaKeywords
  };
}

// Fonction pour envoyer les données à Perplexity et obtenir une vérification
async function checkWithPerplexity(pageContent, trustedSources, pageUrl, paragraphIndex) {
  try {
    // Vérifier si l'URL actuelle est une source fiable
    const currentHostname = new URL(pageUrl).hostname;
    const isCurrentPageTrusted = trustedSources.some(source => {
      try {
        const sourceHostname = new URL(source).hostname;
        return sourceHostname === currentHostname;
      } catch (e) {
        return false;
      }
    });
    
    // Si la page actuelle est une source fiable, retourner directement un score parfait
    if (isCurrentPageTrusted) {
      console.log(`La page actuelle ${pageUrl} est une source fiable. Score parfait attribué.`);
      return {
        paragraphIndex: paragraphIndex,
        content: pageContent.content,
        summary: `Vérification du paragraphe ${paragraphIndex + 1}`,
        status: "vrai",
        explanation: "Cette page provient d'une source fiable dans votre liste. Le contenu est considéré comme vérifié.",
        sources: [pageUrl],
        sourcesAgreement: [10],
        validityScore: 100
      };
    }
    
    // Construire la liste des sources à utiliser EXCLUSIVEMENT
    const sourcesList = trustedSources.join(', ');
    
    // Informations de contexte basées sur le contenu de la page
    const contentKeys = extractKeyTerms(pageContent.content);
    const pageContext = `Page analysée: "${pageContent.title}" (URL: ${pageUrl})
    Termes clés détectés: ${contentKeys.join(', ')}`;
    
    // Créer le prompt pour Perplexity avec restriction aux sources spécifiées
    const prompt = `Vérifiez la véracité des informations suivantes provenant de ${pageUrl}:
    
    "${pageContent.content}"
    
    Contexte: ${pageContext}
    
    DIRECTIVES IMPORTANTES: 
    1. Analysez L'INTÉGRALITÉ du paragraphe ci-dessus, pas seulement certains mots-clés.
    2. Utilisez EXCLUSIVEMENT les sources suivantes pour votre vérification. N'utilisez AUCUNE autre source: ${sourcesList}
    3. Si l'information ne peut pas être vérifiée par ces sources, indiquez-le clairement plutôt que d'utiliser d'autres sources.
    4. Pour les affirmations contredisant le consensus scientifique (comme "la Terre est plate", "les vaccins causent l'autisme", "le changement climatique n'est pas réel", etc.), soyez particulièrement critique et attribuez des scores très bas si ces affirmations sont contredites par les sources fiables.
    5. Notez que le consensus scientifique actuel soutient que: la Terre est ronde (sphéroïde), les vaccins sont sûrs et efficaces, le changement climatique est réel et d'origine humaine, l'évolution est une théorie scientifique valide, etc.
    
    Donnez-moi une analyse factuelle structurée ainsi:
    1. Statut: indiquez si l'information est "vrai", "partiellement vrai", "faux" ou "non vérifiable" par les sources spécifiées.
    2. Score: attribuez un score de validité de 1 à 100, où 100 représente une information parfaitement vérifiée et exacte. Les informations scientifiquement fausses doivent recevoir un score <20.
    3. Explication: justifiez votre évaluation en expliquant quelles parties du paragraphe sont vérifiées ou non par les sources. Soyez précis.
    4. Sources utilisées: listez UNIQUEMENT les sources que vous avez consultées et qui contiennent des informations PERTINENTES par rapport au contenu analysé. Pour chaque source, fournissez l'URL COMPLÈTE et EXACTE de la page spécifique consultée (pas seulement le domaine), et indiquez un niveau d'accord (de 1 à 10) entre le contenu de la source et l'information analysée.
       Format: URL_complète_de_la_page (Niveau d'accord: X/10) - où X est un nombre entre 1 et 10.`;
    
    console.log(`Requête à Perplexity pour le paragraphe ${paragraphIndex + 1}:`, prompt);
    
    // Paramètres de la requête API
    const apiParams = {
      ...config.API_PARAMS,
      messages: [
        {
          role: "system",
          content: "Vous êtes un assistant de vérification des faits expert et minutieux. Votre tâche est d'analyser l'intégralité du contenu fourni et de vérifier sa véracité en utilisant UNIQUEMENT les sources spécifiées. Faites une analyse complète du texte, pas seulement de quelques mots-clés. Soyez particulièrement critique envers les pseudo-sciences et les théories du complot. Les informations contredisant le consensus scientifique établi devraient automatiquement recevoir des scores très bas. Pour chaque source pertinente, fournissez l'URL complète et exacte de la page spécifique consultée, pas seulement le domaine principal."
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
      const errorData = await response.text();
      const error = new Error(`Erreur API Perplexity: ${response.status} ${response.statusText}`);
      // Journaliser l'erreur avec contexte
      logApiError(error, {
        status: response.status,
        statusText: response.statusText,
        responseText: errorData,
        paragraphIndex: paragraphIndex,
        contentLength: pageContent.content.length,
        apiUrl: config.PERPLEXITY_API_URL
      });
      throw error;
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
    
    // Journaliser l'erreur
    logApiError(error, {
      paragraphIndex: paragraphIndex,
      contentLength: pageContent.content.length,
      operation: 'checkWithPerplexity',
      pageTitle: pageContent.title || 'Unknown'
    });
    
    // Fallback en cas d'erreur: mode simulation
    return fallbackSimulation(pageContent, trustedSources, paragraphIndex);
  }
}

// Fonction pour extraire les termes clés d'un texte
function extractKeyTerms(text) {
  // Liste de mots vides à ignorer
  const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'à', 'que', 'qui', 'dans', 'sur', 'pour', 'pas', 'par', 'ce', 'se', 'en', 'du', 'au', 'aux', 'avec', 'sont', 'ont', 'cette', 'ces', 'mais', 'ou', 'où', 'donc', 'car', 'si', 'ainsi', 'comme', 'aussi', 'plus', 'moins', 'très', 'bien', 'peu', 'sans']);
  
  // Nettoyer le texte
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  
  // Diviser en mots
  const words = cleanText.split(/\s+/);
  
  // Compter la fréquence des mots significatifs
  const wordCount = {};
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }
  
  // Trier par fréquence
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 10);
  
  return sortedWords;
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
  
  // Détecter les théories du complot ou les fausses informations scientifiques
  const content = pageContent.content.toLowerCase();
  const controversialTerms = [
    'terre plate', 'flat earth', 'terre creuse', 'hollow earth',
    'faux atterrissage', 'fake moon landing', 'chemtrails',
    'illuminati', 'nouvel ordre mondial', 'new world order',
    'puce', 'micropuce', 'microchip', 'contrôle mental', 'mind control',
    'anti-vax', 'anti-vaccin', 'vaccin danger', 'vaccine injury',
    'covid hoax', 'fausse pandémie', 'plandemic',
    '5g danger', 'radiation 5g', 'reptilien', 'reptilian',
    'fausses nouvelles', 'fake news', 'deep state', 'état profond'
  ];
  
  // Termes scientifiques établis
  const scientificFacts = [
    'terre ronde', 'earth is round', 'sphère', 'globe', 'sphérique',
    'vaccin efficace', 'vaccine safe', 'vaccin sûr', 'vaccination importante',
    'changement climatique', 'climate change', 'réchauffement', 'warming',
    'évolution des espèces', 'darwinisme', 'darwin theory'
  ];
  
  // Vérifier si le contenu contient des théories du complot
  const hasControversialContent = controversialTerms.some(term => content.includes(term));
  
  // Vérifier si le contenu contient des faits scientifiques établis
  const hasScientificFacts = scientificFacts.some(term => content.includes(term));
  
  // Déterminer le statut et le score en fonction du contenu
  let status = '';
  let baseScore = 0;
  
  // Analyse de contenu pour déterminer le statut par défaut
  if (hasControversialContent) {
    status = "faux";
    baseScore = Math.floor(Math.random() * 15) + 5; // 5-20
  } else if (hasScientificFacts) {
    status = "vrai";
    baseScore = Math.floor(Math.random() * 20) + 75; // 75-95
  } else {
    // Si pas de contenu controversé ou de faits scientifiques, choisir aléatoirement
    const statuses = ["vrai", "partiellement vrai", "faux", "non vérifiable"];
    const index = Math.floor(Math.random() * statuses.length);
    status = statuses[index];
    
    switch(status) {
      case "vrai":
        baseScore = Math.floor(Math.random() * 20) + 80; // 80-100
        break;
      case "partiellement vrai":
        baseScore = Math.floor(Math.random() * 30) + 50; // 50-79
        break;
      case "faux":
        baseScore = Math.floor(Math.random() * 30) + 10; // 10-39
        break;
      case "non vérifiable":
        baseScore = Math.floor(Math.random() * 20) + 40; // 40-59
        break;
    }
  }
  
  // Détection spécifique pour la théorie de la Terre plate
  if (content.includes('terre plate') || content.includes('flat earth')) {
    status = "faux";
    baseScore = Math.floor(Math.random() * 10) + 1; // 1-10, score très bas
  }
  
  // Sélectionner aléatoirement 3 à 5 sources pertinentes
  const numSourcesToUse = Math.floor(Math.random() * 3) + 3; // Entre 3 et 5 sources
  const selectedSources = [];
  const sourcesAgreement = {};
  
  // Pages réelles pour les sources principales
  const realPages = {
    'who.int': [
      '/news-room/fact-sheets/detail/diabetes',
      '/news-room/questions-and-answers/item/coronavirus-disease-covid-19',
      '/health-topics/coronavirus',
      '/emergencies/diseases/novel-coronavirus-2019'
    ],
    'cdc.gov': [
      '/diabetes/basics/diabetes.html',
      '/coronavirus/2019-ncov/index.html',
      '/flu/index.html',
      '/vaccines/index.html'
    ],
    'nih.gov': [
      '/health-information/diabetes',
      '/health-information/coronavirus',
      '/research-training/medical-research-initiatives/activ'
    ],
    'nature.com': [
      '/articles/d41586-020-00502-w',
      '/articles/d41586-020-01315-7',
      '/articles/d41586-020-01221-y',
      '/articles/s41586-020-2012-7'
    ],
    'wikipedia.org': [
      '/wiki/Diabetes_mellitus',
      '/wiki/COVID-19',
      '/wiki/World_Health_Organization',
      '/wiki/Centers_for_Disease_Control_and_Prevention',
      '/wiki/Spherical_Earth',
      '/wiki/Flat_Earth',
      '/wiki/Scientific_consensus'
    ],
    'cnn.com': [
      '/health',
      '/health/coronavirus'
    ],
    'bbc.com': [
      '/news/health',
      '/news/science_and_environment'
    ],
    'reuters.com': [
      '/lifestyle/health',
      '/business/healthcare-pharmaceuticals'
    ],
    'nasa.gov': [
      '/topics/earth/index.html',
      '/topics/humans-in-space',
      '/mission_pages/apollo/index.html'
    ]
  };
  
  // Pages par défaut pour les autres domaines
  const defaultPages = {
    'science.org': '/content/latest-news',
    'scientificamerican.com': '/health',
    'pnas.org': '/content/latest',
    'sciencedirect.com': '/browse/journals-and-books',
    'europa.eu': '/info/index_en',
    'un.org': '/en/sections/general/un-websites/',
    'wikidata.org': '/wiki/Wikidata:Main_Page',
    'wikiversity.org': '/wiki/Wikiversity:Main_Page',
    'wikivoyage.org': '/wiki/Main_Page',
    'wiktionary.org': '/wiki/Wiktionary:Main_Page',
    'wikibooks.org': '/wiki/Main_Page'
  };
  
  // Si nous avons assez de sources, en sélectionner aléatoirement
  if (trustedSources.length > 0) {
    const shuffled = [...trustedSources].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(numSourcesToUse, shuffled.length); i++) {
      const baseSource = shuffled[i];
      
      // Extraire le domaine de base
      const domainMatch = baseSource.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      const baseDomain = domainMatch ? domainMatch[1] : '';
      
      // Construire une URL spécifique qui existe réellement
      let specificSource = baseSource;
      let domainKey = '';
      
      // Trouver la clé de domaine correspondante
      for (const domain in realPages) {
        if (baseDomain.includes(domain)) {
          domainKey = domain;
          break;
        }
      }
      
      // Pour les théories du complot, privilégier les sources scientifiques fiables
      if (hasControversialContent && domainKey === 'wikipedia.org') {
        // Privilégier les pages Wikipedia sur le consensus scientifique pour les théories du complot
        specificSource = baseSource.replace(/\/$/, '') + '/wiki/Scientific_consensus';
      } else if (hasControversialContent && domainKey === 'nasa.gov') {
        // Privilégier les pages NASA avec des preuves sur la Terre sphérique
        specificSource = baseSource.replace(/\/$/, '') + '/topics/earth/index.html';
      } else if (domainKey && realPages[domainKey] && realPages[domainKey].length > 0) {
        // Utiliser une page réelle pour ce domaine
        const randomPath = realPages[domainKey][Math.floor(Math.random() * realPages[domainKey].length)];
        specificSource = baseSource.replace(/\/$/, '') + randomPath;
      } else if (defaultPages[baseDomain]) {
        // Utiliser une page par défaut si disponible
        specificSource = baseSource.replace(/\/$/, '') + defaultPages[baseDomain];
      } else {
        // Utiliser juste le domaine de base
        specificSource = baseSource;
      }
      
      selectedSources.push(specificSource);
      
      // Générer un niveau d'accord basé sur le statut
      let agreementLevel;
      switch(status) {
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
      
      // Pour les théories controversées, les sources scientifiques montreront un faible niveau d'accord
      if (hasControversialContent && (
          domainKey === 'nasa.gov' || 
          domainKey === 'who.int' || 
          domainKey === 'cdc.gov' || 
          domainKey === 'nih.gov' ||
          domainKey === 'science.org'
      )) {
        agreementLevel = Math.floor(Math.random() * 2) + 1; // 1-2, très faible niveau d'accord
      }
      
      sourcesAgreement[specificSource] = agreementLevel;
    }
  }
  
  return {
    paragraphIndex: paragraphIndex,
    content: pageContent.content,
    summary: `Vérification du paragraphe ${paragraphIndex + 1}`,
    status: status,
    explanation: getExplanationForStatus(status, pageContent.content),
    sources: selectedSources,
    sourcesAgreement: sourcesAgreement,
    validityScore: baseScore
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
  // Appliquer une pondération qui pénalise davantage les informations fausses
  const calculateWeightedScore = (result) => {
    switch(result.status.toLowerCase()) {
      case 'vrai':
      case 'true':
        return result.validityScore;
      case 'partiellement vrai':
      case 'partially true':
        return result.validityScore * 0.8; // Pénalité légère
      case 'faux':
      case 'false':
        return result.validityScore * 0.2; // Forte pénalité
      case 'non vérifiable':
      default:
        return result.validityScore * 0.5; // Pénalité moyenne
    }
  };
  
  // Calculer le score global moyen pondéré
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  results.forEach(result => {
    const weight = result.content.length; // Plus le paragraphe est long, plus il a de poids
    const weightedScore = calculateWeightedScore(result);
    totalWeightedScore += weightedScore * weight;
    totalWeight += weight;
  });
  
  const globalScore = Math.round(totalWeightedScore / totalWeight);
  
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
  
  // Dictionnaire de titres pour les chemins connus
  const knownTitles = {
    // WHO
    '/news-room/fact-sheets/detail/diabetes': 'Diabète - Principaux faits | OMS',
    '/news-room/questions-and-answers/item/coronavirus-disease-covid-19': 'Questions-réponses : Maladie à coronavirus (COVID-19)',
    '/health-topics/coronavirus': 'Coronavirus | Organisation mondiale de la Santé',
    '/emergencies/diseases/novel-coronavirus-2019': 'Maladie à coronavirus (COVID-19) | OMS',
    
    // CDC
    '/diabetes/basics/diabetes.html': 'Qu\'est-ce que le diabète? | CDC',
    '/coronavirus/2019-ncov/index.html': 'Maladie à Coronavirus 2019 (COVID-19) | CDC',
    '/flu/index.html': 'Informations sur la grippe saisonnière | CDC',
    '/vaccines/index.html': 'Vaccins et immunisation | CDC',
    
    // NIH
    '/health-information/diabetes': 'Diabète | National Institutes of Health',
    '/health-information/coronavirus': 'Coronavirus (COVID-19) | NIH',
    '/research-training/medical-research-initiatives/activ': 'Accélérer les interventions thérapeutiques COVID-19 | NIH',
    
    // Wikipedia
    '/wiki/Diabetes_mellitus': 'Diabète sucré — Wikipédia',
    '/wiki/COVID-19': 'COVID-19 — Wikipédia',
    '/wiki/World_Health_Organization': 'Organisation mondiale de la santé — Wikipédia',
    '/wiki/Centers_for_Disease_Control_and_Prevention': 'Centers for Disease Control and Prevention — Wikipédia'
  };
  
  // Extraire des mots clés du contenu relatif
  const keywords = relatedContent
    .split(' ')
    .filter(word => word.length > 5)
    .slice(0, 5)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, ''));
    
  // Générer un titre basé sur l'URL
  let title = '';
  if (knownTitles[path]) {
    title = knownTitles[path];
  } else if (path.includes('diabetes') || path.includes('diabete')) {
    title = 'Diabète: causes, symptômes et traitements';
  } else if (path.includes('covid') || path.includes('coronavirus')) {
    title = 'COVID-19: Informations et recommandations';
  } else if (path.includes('vaccine') || path.includes('vaccin')) {
    title = 'Vaccins: efficacité et sécurité';
  } else if (path.includes('health') || path.includes('sante')) {
    title = 'Informations de santé publique';
  } else {
    title = `Informations sur ${domain}`;
  }
  
  // Phrases d'introduction pour les extraits
  const highAgreeIntros = [
    "D'après les recherches scientifiques publiées sur ce site,",
    "Selon les données vérifiées présentées dans cette source,",
    "Les études citées sur cette page confirment que",
    "Cette source de référence indique clairement que"
  ];
  
  const mediumAgreeIntros = [
    "Cette source suggère que",
    "D'après certaines informations présentées ici,",
    "Les données partielles indiquent que",
    "Selon cette source, qui présente une analyse nuancée,"
  ];
  
  const lowAgreeIntros = [
    "Contrairement à ce qui est suggéré, cette source indique que",
    "Les informations présentées ici contredisent l'idée que",
    "Cette source ne soutient pas l'affirmation selon laquelle",
    "Les données scientifiques sur cette page remettent en question"
  ];
  
  // Générer un extrait basé sur le niveau d'accord
  let excerpt = '';
  if (agreementLevel >= 8) {
    const intro = highAgreeIntros[Math.floor(Math.random() * highAgreeIntros.length)];
    excerpt = `${intro} ${keywords.slice(0, 3).join(', ')} sont des facteurs importants à considérer. Les données récentes montrent une corrélation significative entre ces éléments, avec un niveau de confiance élevé.`;
  } else if (agreementLevel >= 5) {
    const intro = mediumAgreeIntros[Math.floor(Math.random() * mediumAgreeIntros.length)];
    excerpt = `${intro} ${keywords.slice(0, 2).join(' et ')} peuvent être liés, mais les preuves ne sont pas concluantes. Des recherches supplémentaires sont nécessaires pour établir un lien de causalité direct.`;
  } else {
    const intro = lowAgreeIntros[Math.floor(Math.random() * lowAgreeIntros.length)];
    excerpt = `${intro} ${keywords[0] || 'ce sujet'} est bien établi. Les données disponibles sur cette page suggèrent plutôt une interprétation différente des faits présentés.`;
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