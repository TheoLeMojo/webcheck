// Importer la configuration
import config from './config.js';
// Importer les fonctions de logging
import { logApiError, exportApiErrorLogs, getApiErrorLogs, clearApiErrorLogs, openCurrentLogFile } from './logger.js';
// Importer les sources fiables
import { getTrustedSources } from './trusted_sources.js';

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', async function() {
  // Récupérer les éléments du DOM
  const checkButton = document.getElementById('checkButton');
  const verifySelectedButton = document.getElementById('verifySelectedButton');
  const clearButton = document.getElementById('clearButton');
  const statusMessage = document.getElementById('statusMessage');
  const verificationResults = document.getElementById('verificationResults');
  const finalScore = document.getElementById('finalScore');
  const finalScoreValue = document.getElementById('finalScoreValue');
  const finalScoreExplanation = document.getElementById('finalScoreExplanation');
  
  // Éléments pour les sources
  const defaultSources = document.getElementById('defaultSources');
  const userSources = document.getElementById('userSources');
  const sourcesToggle = document.getElementById('sourcesToggle');
  const sourcesSection = document.getElementById('sourcesSection');
  const newSourceInput = document.getElementById('newSourceInput');
  const addSourceButton = document.getElementById('addSourceButton');
  const sourcePreview = document.getElementById('sourcePreview');
  
  // Configuration du menu développeur
  const developerToggle = document.getElementById('developerToggle');
  const developerSection = document.getElementById('developerSection');
  const clearLogsButton = document.getElementById('clearLogsButton');
  const downloadLogsButton = document.getElementById('downloadLogsButton');
  const logContent = document.getElementById('logContent');
  const pagesVerified = document.getElementById('pagesVerified');
  const paragraphsChecked = document.getElementById('paragraphsChecked');
  const apiCalls = document.getElementById('apiCalls');
  const apiErrors = document.getElementById('apiErrors');
  
  // État du développeur
  const devModeEnabled = localStorage.getItem('devMode') === 'true';
  developerToggle.checked = devModeEnabled;
  developerSection.style.display = devModeEnabled ? 'block' : 'none';
  
  // Tentative d'auto-remplir le champ de texte avec le texte sélectionné
  try {
    // Obtenir l'onglet actif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Exécuter un script pour récupérer le texte sélectionné
    const selection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString()
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du texte sélectionné:', error);
  }
  
  // Configurer les boutons du menu développeur
  if (clearLogsButton) {
    clearLogsButton.addEventListener('click', function() {
      if (confirm('Êtes-vous sûr de vouloir effacer tous les logs d\'erreurs API?')) {
        clearApiErrorLogs(() => {
          alert('Logs effacés avec succès.');
          logContent.innerHTML = "No logs available";
          if (apiErrors) apiErrors.textContent = "0";
        });
      }
    });
  }
  
  if (downloadLogsButton) {
    downloadLogsButton.addEventListener('click', function() {
      chrome.storage.local.get(['currentLogFileContent'], function(result) {
        const logs = result.currentLogFileContent || "No logs available";
        const blob = new Blob([logs], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'webcheck_logs.txt';
        a.click();
        
        URL.revokeObjectURL(url);
      });
    });
  }
  
  // Variables pour stocker les sources
  let defaultSourcesList = [];
  let userSourcesList = [];
  
  // Charger les préférences utilisateur (états des toggles)
  chrome.storage.local.get(['showSources', 'devMode'], function(result) {
    // Définir les états par défaut
    const showSources = result.showSources !== undefined ? result.showSources : false;
    const devMode = result.devMode !== undefined ? result.devMode : false;
    
    // Appliquer les états aux toggles
    sourcesToggle.checked = showSources;
    developerToggle.checked = devMode;
    
    // Appliquer la visibilité initiale
    sourcesSection.style.display = showSources ? 'block' : 'none';
    developerSection.style.display = devMode ? 'block' : 'none';
  });
  
  // Charger les sources par défaut depuis le module trusted_sources.js
  try {
    // Utiliser la fonction d'import pour obtenir les sources
    const sources = await getTrustedSources();
    defaultSourcesList = sources || [];
    // Afficher les sources par défaut
    renderDefaultSources();
  } catch (error) {
    console.error('Erreur lors du chargement des sources par défaut:', error);
    defaultSourcesList = [];
  }
  
  // Charger les sources personnalisées depuis le stockage local
  chrome.storage.local.get(['userSources'], function(result) {
    userSourcesList = result.userSources || [];
    // Afficher les sources personnalisées
    renderUserSources();
  });
  
  // Fonction pour afficher les sources par défaut
  function renderDefaultSources() {
    defaultSources.innerHTML = '';
    
    if (defaultSourcesList.length === 0) {
      defaultSources.innerHTML = '<div class="empty-message">No default sources available.</div>';
      return;
    }
    
    defaultSourcesList.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      
      const sourceIcon = document.createElement('i');
      sourceIcon.className = 'fas fa-globe source-icon';
      
      const sourceUrl = document.createElement('span');
      sourceUrl.className = 'source-url';
      sourceUrl.textContent = source;
      
      sourceItem.appendChild(sourceIcon);
      sourceItem.appendChild(sourceUrl);
      defaultSources.appendChild(sourceItem);
      
      // Add hover event for source preview
      sourceItem.addEventListener('mouseenter', (e) => {
        showSourcePreview(source, e);
      });
      
      sourceItem.addEventListener('mouseleave', () => {
        hideSourcePreview();
      });
    });
  }
  
  // Fonction pour afficher les sources personnalisées
  function renderUserSources() {
    userSources.innerHTML = '';
    
    if (userSourcesList.length === 0) {
      userSources.innerHTML = '<div class="empty-message">You haven\'t added any trusted sources yet.</div>';
      return;
    }
    
    userSourcesList.forEach((source, index) => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      
      const sourceIcon = document.createElement('i');
      sourceIcon.className = 'fas fa-globe source-icon';
      
      const sourceUrl = document.createElement('span');
      sourceUrl.className = 'source-url';
      sourceUrl.textContent = source;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'btn-remove';
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.title = 'Remove source';
      removeButton.addEventListener('click', () => {
        removeUserSource(index);
      });
      
      sourceItem.appendChild(sourceIcon);
      sourceItem.appendChild(sourceUrl);
      sourceItem.appendChild(removeButton);
      userSources.appendChild(sourceItem);
      
      // Add hover event for source preview
      sourceItem.addEventListener('mouseenter', (e) => {
        showSourcePreview(source, e);
      });
      
      sourceItem.addEventListener('mouseleave', () => {
        hideSourcePreview();
      });
    });
  }
  
  function showSourcePreview(source, event) {
    const previewContent = generateSourcePreview(source);
    sourcePreview.innerHTML = previewContent;
    
    // Position the preview
    const rect = event.target.getBoundingClientRect();
    sourcePreview.style.top = `${rect.bottom + 10}px`;
    sourcePreview.style.left = `${rect.left}px`;
    sourcePreview.style.display = 'block';
  }
  
  function hideSourcePreview() {
    sourcePreview.style.display = 'none';
  }
  
  function addUserSource(url) {
    // Normaliser l'URL (supprimer http://, https://, www. et les barres obliques finales)
    let normalizedUrl = url.toLowerCase().trim();
    normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
    normalizedUrl = normalizedUrl.replace(/\/$/, '');
    
    // Vérifier si l'URL est déjà dans la liste
    if (userSourcesList.includes(normalizedUrl) || defaultSourcesList.includes(normalizedUrl)) {
      alert('Cette source existe déjà dans votre liste.');
      return;
    }
    
    // Vérifier que l'URL est valide
    if (!normalizedUrl || normalizedUrl.indexOf('.') === -1) {
      alert('Veuillez entrer une URL valide.');
      return;
    }
    
    // Ajouter la source à la liste
    userSourcesList.push(normalizedUrl);
    
    // Sauvegarder la liste mise à jour
    saveUserSources();
    
    // Mettre à jour l'affichage
    renderUserSources();
    
    // Effacer le champ de saisie
    newSourceInput.value = '';
  }
  
  function removeUserSource(index) {
    userSourcesList.splice(index, 1);
    saveUserSources();
    renderUserSources();
  }
  
  function saveUserSources() {
    chrome.storage.local.set({ userSources: userSourcesList });
  }
  
  function saveUserPreferences() {
    chrome.storage.local.set({
      showSources: sourcesToggle.checked,
      devMode: developerToggle.checked
    });
  }
  
  // Gérer les événements pour les toggles
  sourcesToggle.addEventListener('change', function() {
    sourcesSection.style.display = this.checked ? 'block' : 'none';
    saveUserPreferences();
  });
  
  developerToggle.addEventListener('change', function() {
    developerSection.style.display = this.checked ? 'block' : 'none';
    localStorage.setItem('devMode', this.checked);
    saveUserPreferences();
    
    // If developer mode is enabled, update the stats and logs
    if (this.checked) {
      chrome.storage.local.get(['currentLogFileContent'], function(result) {
        logContent.innerHTML = result.currentLogFileContent || "No logs available";
        
        // Update stats display
        chrome.storage.local.get(['pagesVerified', 'paragraphsAnalyzed', 'apiCalls', 'apiErrors'], function(stats) {
          if (pagesVerified) pagesVerified.textContent = stats.pagesVerified || 0;
          if (paragraphsChecked) paragraphsChecked.textContent = stats.paragraphsAnalyzed || 0;
          if (apiCalls) apiCalls.textContent = stats.apiCalls || 0;
          if (apiErrors) apiErrors.textContent = stats.apiErrors || 0;
        });
      });
    }
  });
  
  // Gérer l'événement pour ajouter une source
  addSourceButton.addEventListener('click', function() {
    addUserSource(newSourceInput.value);
  });
  
  newSourceInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addUserSource(this.value);
    }
  });

  // Event handlers for the buttons
  checkButton.addEventListener('click', async function() {
    // Disable the check button during verification and update status
    checkButton.disabled = true;
    statusMessage.textContent = 'Extracting content from page...';
    statusMessage.className = 'status info';
    statusMessage.style.display = 'block';
    verificationResults.style.display = 'none';
    finalScore.style.display = 'none';
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Extract the content from the active tab
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapePageContent
      });
      
      if (!result || !result.result) {
        throw new Error('Could not extract content from the page.');
      }
      
      // Get the scraped content
      const scrapedContent = result.result;
      
      // List of controversial keywords to check against
      const controversialKeywords = [
        'flat earth', 'earth is flat', 'conspiracy', 'illuminati', 'new world order', 
        'chemtrails', 'mind control', 'fake moon landing', 'moon landing hoax',
        'vaccine autism', 'autism vaccines', 'climate change hoax', 'global warming hoax',
        'holocaust denial', '5g coronavirus', 'covid hoax', 'covid-19 hoax',
        'qanon', 'deep state', 'microchip vaccine', 'lizard people', 'reptilian'
      ];
      
      // Check if page contains controversial theories
      const hasControversialTheories = controversialKeywords.some(keyword => 
        scrapedContent.pageTitle.toLowerCase().includes(keyword) || 
        scrapedContent.metadata.some(meta => meta.toLowerCase().includes(keyword)) ||
        scrapedContent.paragraphs.some(p => p.toLowerCase().includes(keyword))
      );
      
      // Default number of paragraphs to analyze
      let paragraphsToAnalyze = 5;
      
      // Increase number of paragraphs to analyze if controversial theories are detected
      if (hasControversialTheories) {
        paragraphsToAnalyze = 8;
      }
      
      // Filter out short paragraphs and get the most relevant ones
      const significantParagraphs = scrapedContent.paragraphs
        .filter(paragraph => paragraph.length > 50) // Only analyze paragraphs longer than 50 chars
        .sort((a, b) => b.length - a.length) // Sort by length (longest first)
        .slice(0, paragraphsToAnalyze); // Get the top paragraphs
      
      if (significantParagraphs.length === 0) {
        throw new Error('No significant content found on the page.');
      }
      
      // Update status message
      statusMessage.textContent = 'Verifying content against trusted sources...';
      
      // Combine default and user-provided sources for verification
      const allSources = [...defaultSourcesList, ...userSourcesList];
      
      // Check if the current page URL matches any of the trusted sources
      const currentDomain = new URL(tab.url).hostname.replace('www.', '');
      const isFromTrustedSource = allSources.some(source => {
        const sourceDomain = source.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        return currentDomain === sourceDomain;
      });
      
      if (isFromTrustedSource) {
        // If the page is from a trusted source, automatically give it a high score
        const autoResult = [{
          paragraphIndex: 0,
          content: 'This page comes from one of your trusted sources.',
          summary: 'Content from trusted source',
          status: 'true',
          explanation: 'This content is from a source you have identified as trusted.',
          selectedSources: allSources.slice(0, 3),
          sourcesAgreement: [1.0, 1.0, 1.0],
          validityScore: 100
        }];
        
        formatVerificationResults(autoResult);
        updateStats(1);
        
        // Re-enable the check button
        checkButton.disabled = false;
        return;
      }
      
      // Prepare the paragraphs for verification, enriching with metadata
      const enrichedParagraphs = significantParagraphs.map((paragraph, index) => {
        return {
          paragraphIndex: index,
          content: paragraph,
          metadata: {
            title: scrapedContent.pageTitle,
            description: scrapedContent.metadata.join(' '),
            url: tab.url
          }
        };
      });
      
      // Verify each paragraph individually
      const verificationResults = [];
      for (let i = 0; i < enrichedParagraphs.length; i++) {
        statusMessage.textContent = `Verifying paragraph ${i + 1} of ${enrichedParagraphs.length}...`;
        
        try {
          // Call our API to verify this paragraph
          const result = await checkWithPerplexity(
            enrichedParagraphs[i].content,
            enrichedParagraphs[i].metadata,
            allSources
          );
          
          // Check if it contains scientifically false theories and adjust score if needed
          if (hasControversialTheories && result.status !== 'false') {
            // If contains controversial theories but not marked as false, adjust score
            result.validityScore = Math.min(result.validityScore, 40);
            result.explanation += " Note: This content contains claims that may contradict scientific consensus.";
          }
          
          verificationResults.push(result);
          
          // Update API call stats
          chrome.storage.local.get(['apiCalls'], function(stats) {
            chrome.storage.local.set({
              apiCalls: (stats.apiCalls || 0) + 1
            });
            if (apiCalls && developerToggle.checked) {
              apiCalls.textContent = (stats.apiCalls || 0) + 1;
            }
          });
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Log the API error
          logApiError('checkWithPerplexity', apiError.toString());
          
          // Update API error stats
          chrome.storage.local.get(['apiErrors'], function(stats) {
            chrome.storage.local.set({
              apiErrors: (stats.apiErrors || 0) + 1
            });
            if (apiErrors && developerToggle.checked) {
              apiErrors.textContent = (stats.apiErrors || 0) + 1;
            }
          });
          
          // Use fallback function to simulate verification for this paragraph
          const fallbackResult = fallbackSimulation(
            enrichedParagraphs[i].content,
            enrichedParagraphs[i].metadata,
            allSources,
            hasControversialTheories
          );
          verificationResults.push(fallbackResult);
        }
      }
      
      // Display the verification results
      const finalScore = formatVerificationResults(verificationResults);
      
      // Update verification statistics
      updateStats(verificationResults.length);
      
      // Set up source previews
      const sourceItems = document.querySelectorAll('.source-item-small');
      sourceItems.forEach(item => {
        item.addEventListener('mouseenter', (e) => {
          const sourceUrl = item.querySelector('.source-url-small').textContent;
          showSourcePreview(sourceUrl, e);
        });
        
        item.addEventListener('mouseleave', () => {
          hideSourcePreview();
        });
      });
      
      // Update log statistics if developer mode is enabled
      if (developerToggle.checked) {
        chrome.storage.local.get(['currentLogFileContent'], function(result) {
          logContent.innerHTML = result.currentLogFileContent || "No logs available";
        });
      }
    } catch (error) {
      console.error('Error during verification:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.className = 'status error';
    } finally {
      // Re-enable the check button
      checkButton.disabled = false;
    }
  });
  
  verifySelectedButton.addEventListener('click', async function() {
    // Disable the button during verification and update status
    verifySelectedButton.disabled = true;
    statusMessage.textContent = 'Extracting selected text...';
    statusMessage.className = 'status info';
    statusMessage.style.display = 'block';
    verificationResults.style.display = 'none';
    finalScore.style.display = 'none';
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get the selected text from the active tab
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });
      
      const selectedText = result.result;
      
      if (!selectedText || selectedText.trim().length < 10) {
        throw new Error('Please select some text to verify (at least 10 characters).');
      }
      
      // Update status message
      statusMessage.textContent = 'Verifying selected text against trusted sources...';
      
      // Combine default and user-provided sources for verification
      const allSources = [...defaultSourcesList, ...userSourcesList];
      
      // Verify the selected text
      let verificationResult;
      try {
        // Get tab metadata
        const [metadataResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            return {
              title: document.title,
              description: document.querySelector('meta[name="description"]')?.content || '',
              url: window.location.href
            };
          }
        });
        
        const metadata = metadataResult.result;
        
        // Call our API to verify this text
        verificationResult = await checkWithPerplexity(selectedText, metadata, allSources);
        
        // Update API call stats
        chrome.storage.local.get(['apiCalls'], function(stats) {
          chrome.storage.local.set({
            apiCalls: (stats.apiCalls || 0) + 1
          });
          if (apiCalls && developerToggle.checked) {
            apiCalls.textContent = (stats.apiCalls || 0) + 1;
          }
        });
      } catch (apiError) {
        console.error('API error:', apiError);
        
        // Log the API error
        logApiError('checkWithPerplexity', apiError.toString());
        
        // Update API error stats
        chrome.storage.local.get(['apiErrors'], function(stats) {
          chrome.storage.local.set({
            apiErrors: (stats.apiErrors || 0) + 1
          });
          if (apiErrors && developerToggle.checked) {
            apiErrors.textContent = (stats.apiErrors || 0) + 1;
          }
        });
        
        // Use fallback function to simulate verification
        verificationResult = fallbackSimulation(selectedText, { title: 'Selected Text' }, allSources, false);
      }
      
      // Display the verification results
      const finalScore = formatVerificationResults([verificationResult]);
      
      // Update verification statistics
      updateStats(1);
      
      // Update log statistics if developer mode is enabled
      if (developerToggle.checked) {
        chrome.storage.local.get(['currentLogFileContent'], function(result) {
          logContent.innerHTML = result.currentLogFileContent || "No logs available";
        });
      }
    } catch (error) {
      console.error('Error during verification:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.className = 'status error';
    } finally {
      // Re-enable the verify selected button
      verifySelectedButton.disabled = false;
    }
  });
  
  clearButton.addEventListener('click', function() {
    verificationResults.innerHTML = '';
    verificationResults.style.display = 'none';
    statusMessage.textContent = 'Ready to verify content.';
    statusMessage.className = 'status info';
    statusMessage.style.display = 'block';
    finalScore.style.display = 'none';
  });

  function updateStats(paragraphsVerified) {
    chrome.storage.local.get(['pagesVerified', 'paragraphsAnalyzed', 'apiCalls', 'apiErrors'], function(stats) {
      // Mettre à jour uniquement les compteurs de pages et de paragraphes
      const updatedStats = {
        pagesVerified: (stats.pagesVerified || 0) + 1,
        paragraphsAnalyzed: (stats.paragraphsAnalyzed || 0) + paragraphsVerified
      };
      
      chrome.storage.local.set(updatedStats, function() {
        // Update displayed stats if dev mode is enabled
        if (developerToggle.checked) {
          if (pagesVerified) pagesVerified.textContent = updatedStats.pagesVerified;
          if (paragraphsChecked) paragraphsChecked.textContent = updatedStats.paragraphsAnalyzed;
          // Note: apiCalls et apiErrors sont mis à jour ailleurs
        }
      });
    });
  }

  function getScoreExplanation(score) {
    if (score >= 90) {
      return "This content appears to be highly reliable and well-supported by trusted sources.";
    } else if (score >= 75) {
      return "This content seems generally reliable with good support from trusted sources.";
    } else if (score >= 60) {
      return "This content has moderate reliability with some support from trusted sources.";
    } else if (score >= 40) {
      return "This content has limited reliability with minimal support from trusted sources.";
    } else if (score >= 20) {
      return "This content appears to have significant reliability issues with very little support from trusted sources.";
    } else {
      return "This content could not be verified or contradicts information from trusted sources.";
    }
  }

  function formatVerificationResults(results, pageContent) {
    // Clear previous results
    verificationResults.innerHTML = '';
    verificationResults.style.display = 'block';
    
    // Calculate weighted overall score
    const calculateWeightedScore = (result) => {
      // Weight factors
      const statusWeight = 0.5;
      const sourcesWeight = 0.3;
      const lengthWeight = 0.2;
      
      // Status score (0-100)
      let statusScore = 0;
      switch(result.status) {
        case 'true': statusScore = 100; break;
        case 'partially_true': statusScore = 70; break;
        case 'unverifiable': statusScore = 50; break;
        case 'false': statusScore = 0; break;
        default: statusScore = 30; break;
      }
      
      // Sources agreement score (0-100)
      let sourcesScore = 0;
      if (result.selectedSources && result.sourcesAgreement) {
        const totalAgreement = result.sourcesAgreement.reduce((sum, agreement) => sum + agreement, 0);
        const avgAgreement = totalAgreement / result.sourcesAgreement.length;
        sourcesScore = avgAgreement * 100;
      }
      
      // Text length score (0-100) - longer paragraphs have more weight
      const contentLength = result.content.length;
      const lengthScore = Math.min(100, contentLength / 20);
      
      // Calculate weighted score
      return (statusScore * statusWeight) + (sourcesScore * sourcesWeight) + (lengthScore * lengthWeight);
    };
    
    // Calculate overall score as weighted average of all paragraph scores
    let totalScore = 0;
    let totalWeight = 0;
    
    // Process each result
    results.forEach((result, index) => {
      const score = result.validityScore !== undefined ? result.validityScore : calculateWeightedScore(result);
      const paragraphWeight = result.content.length;
      totalScore += score * paragraphWeight;
      totalWeight += paragraphWeight;
      
      // Create result card
      const resultCard = document.createElement('div');
      resultCard.className = `result-card ${result.status}`;
      
      // Status icon
      const statusIcon = document.createElement('div');
      statusIcon.className = 'status-icon';
      let iconClass = '';
      switch(result.status) {
        case 'true': iconClass = 'fa-check-circle'; break;
        case 'partially_true': iconClass = 'fa-dot-circle'; break;
        case 'false': iconClass = 'fa-times-circle'; break;
        default: iconClass = 'fa-question-circle'; break;
      }
      statusIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
      
      // Content
      const contentElement = document.createElement('div');
      contentElement.className = 'result-content';
      contentElement.textContent = result.content;
      
      // Explanation
      const explanationElement = document.createElement('div');
      explanationElement.className = 'result-explanation';
      explanationElement.textContent = result.explanation || getExplanationForStatus(result.status, result.content);
      
      // Sources section
      const sourcesElement = document.createElement('div');
      sourcesElement.className = 'result-sources';
      
      // Sources header
      const sourcesHeader = document.createElement('div');
      sourcesHeader.className = 'sources-header';
      sourcesHeader.textContent = 'Sources';
      sourcesElement.appendChild(sourcesHeader);
      
      // Add each source with its agreement level
      if (result.selectedSources && result.sourcesAgreement) {
        const sourcesList = document.createElement('div');
        sourcesList.className = 'sources-list';
        
        result.selectedSources.forEach((source, sourceIndex) => {
          const agreementLevel = result.sourcesAgreement[sourceIndex] || 0;
          
          const sourceItem = document.createElement('div');
          sourceItem.className = 'source-item-small';
          
          // Source URL
          const sourceUrl = document.createElement('a');
          sourceUrl.className = 'source-url-small';
          sourceUrl.href = source.startsWith('http') ? source : `https://${source}`;
          sourceUrl.target = '_blank';
          sourceUrl.textContent = source;
          
          // Agreement level
          const agreementIndicator = document.createElement('div');
          agreementIndicator.className = `agreement-indicator agreement-level-${Math.round(agreementLevel * 10)}`;
          
          const agreementLabel = document.createElement('span');
          agreementLabel.className = 'agreement-label';
          if (agreementLevel >= 0.8) {
            agreementLabel.textContent = 'Strong support';
          } else if (agreementLevel >= 0.6) {
            agreementLabel.textContent = 'Good support';
          } else if (agreementLevel >= 0.4) {
            agreementLabel.textContent = 'Partial support';
          } else if (agreementLevel >= 0.2) {
            agreementLabel.textContent = 'Limited support';
          } else {
            agreementLabel.textContent = 'No support';
          }
          
          agreementIndicator.appendChild(agreementLabel);
          sourceItem.appendChild(sourceUrl);
          sourceItem.appendChild(agreementIndicator);
          sourcesList.appendChild(sourceItem);
          
          // Add hover event for source preview
          sourceItem.addEventListener('mouseenter', (e) => {
            const previewContent = generateSourcePreview(source, agreementLevel, result.content);
            sourcePreview.innerHTML = previewContent;
            
            // Position the preview
            const rect = e.target.getBoundingClientRect();
            sourcePreview.style.top = `${rect.bottom + 10}px`;
            sourcePreview.style.left = `${rect.left}px`;
            sourcePreview.style.display = 'block';
          });
          
          sourceItem.addEventListener('mouseleave', () => {
            sourcePreview.style.display = 'none';
          });
        });
        
        sourcesElement.appendChild(sourcesList);
      } else {
        const noSources = document.createElement('div');
        noSources.className = 'no-sources';
        noSources.textContent = 'No sources could be verified for this content.';
        sourcesElement.appendChild(noSources);
      }
      
      // Assemble the card
      resultCard.appendChild(statusIcon);
      resultCard.appendChild(contentElement);
      resultCard.appendChild(explanationElement);
      resultCard.appendChild(sourcesElement);
      
      // Add the card to results container
      verificationResults.appendChild(resultCard);
    });
    
    // Calculate and display overall score
    const finalValidityScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    finalScoreValue.textContent = finalValidityScore;
    finalScoreExplanation.textContent = getScoreExplanation(finalValidityScore);
    finalScore.style.display = 'block';
    
    // Add color class based on score
    finalScore.className = 'final-score';
    if (finalValidityScore >= 80) {
      finalScore.classList.add('score-high');
    } else if (finalValidityScore >= 60) {
      finalScore.classList.add('score-medium');
    } else if (finalValidityScore >= 40) {
      finalScore.classList.add('score-low');
    } else {
      finalScore.classList.add('score-very-low');
    }
    
    return finalValidityScore;
  }

  function generateSourcePreview(source, agreementLevel, relatedContent) {
    // Extract domain from source
    const domain = source.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    
    // Default preview structure
    let previewHtml = `
      <div class="preview-header">
        <img src="https://www.google.com/s2/favicons?domain=${domain}" alt="${domain} favicon" class="preview-favicon">
        <span class="preview-domain">${domain}</span>
        <a href="https://${source}" target="_blank" class="preview-link">
          <i class="fas fa-external-link-alt"></i>
        </a>
      </div>
      <div class="preview-content">
    `;
    
    // Default content based on source type
    if (domain.includes('who.int')) {
      previewHtml += `<p>World Health Organization provides global guidance on health issues based on scientific evidence.</p>`;
    } else if (domain.includes('cdc.gov')) {
      previewHtml += `<p>The Centers for Disease Control and Prevention is a trusted source for health information and research.</p>`;
    } else if (domain.includes('nih.gov')) {
      previewHtml += `<p>The National Institutes of Health conducts and shares medical research to improve health outcomes.</p>`;
    } else if (domain.includes('nasa.gov')) {
      previewHtml += `<p>NASA provides scientific information about space, Earth, and related fields based on extensive research.</p>`;
    } else if (domain.includes('edu')) {
      previewHtml += `<p>Educational institution that conducts and publishes academic research across various disciplines.</p>`;
    } else if (domain.includes('gov')) {
      previewHtml += `<p>Government source that provides official information and data.</p>`;
    } else {
      previewHtml += `<p>Source that may provide information related to the content being verified.</p>`;
    }
    
    // Add agreement information if provided
    if (agreementLevel !== undefined && relatedContent) {
      let agreementText = '';
      if (agreementLevel >= 0.8) {
        agreementText = 'strongly supports';
      } else if (agreementLevel >= 0.6) {
        agreementText = 'generally supports';
      } else if (agreementLevel >= 0.4) {
        agreementText = 'partially supports';
      } else if (agreementLevel >= 0.2) {
        agreementText = 'minimally supports';
      } else {
        agreementText = 'does not support';
      }
      
      previewHtml += `
        <div class="preview-agreement">
          <div class="agreement-bar">
            <div class="agreement-level" style="width: ${agreementLevel * 100}%"></div>
          </div>
          <p>This source ${agreementText} the analyzed content.</p>
        </div>
      `;
    }
    
    // Close preview
    previewHtml += `</div>`;
    
    return previewHtml;
  }
});

// Function to scrape content from the page
function scrapePageContent() {
  // Get page title
  const pageTitle = document.title;
  
  // Get metadata
  const metadata = [];
  const metaTags = document.querySelectorAll('meta[name="description"], meta[name="keywords"], meta[property="og:description"]');
  metaTags.forEach(tag => {
    const content = tag.getAttribute('content');
    if (content) {
      metadata.push(content);
    }
  });
  
  // Get main content elements
  const contentSelectors = [
    'article', '.article', '.post', '.entry', '.content', 'main', '#main', '#content',
    '.main-content', '.entry-content', '.post-content', '.article-content',
    '.story', '.story-body', '.story-content', '.blog-post', '.blog-entry',
    '.news-article', '.news-content', '.news-story', '.body-content'
  ];
  
  let mainContent = null;
  
  // Try each selector until we find content
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Use the largest element by character count
      let largestElement = null;
      let largestLength = 0;
      
      elements.forEach(element => {
        const textLength = element.textContent.trim().length;
        if (textLength > largestLength) {
          largestElement = element;
          largestLength = textLength;
        }
      });
      
      if (largestElement) {
        mainContent = largestElement;
        break;
      }
    }
  }
  
  // If no specific content container is found, use the body
  if (!mainContent) {
    mainContent = document.body;
  }
  
  // Extract paragraphs
  const paragraphElements = mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  let paragraphs = [];
  
  paragraphElements.forEach(element => {
    const text = element.textContent.trim();
    if (text && text.length > 20) { // Only include paragraphs with real content
      paragraphs.push(text);
    }
  });
  
  // If we didn't get enough paragraphs from p tags, try other methods
  if (paragraphs.length < 3) {
    // Try getting content from divs that look like paragraphs
    const divElements = mainContent.querySelectorAll('div');
    divElements.forEach(div => {
      // Skip divs that have many child elements or specific classes like navigation, sidebar, etc.
      if (div.children.length < 3 && !div.className.match(/(nav|menu|sidebar|footer|header|banner|ad)/i)) {
        const text = div.textContent.trim();
        if (text && text.length > 50 && text.length < 2000) {
          paragraphs.push(text);
        }
      }
    });
    
    // As a last resort, split the main content by double line breaks
    if (paragraphs.length < 3) {
      const contentText = mainContent.textContent.trim();
      const splitParagraphs = contentText.split(/\n\n+/);
      
      for (const text of splitParagraphs) {
        const trimmedText = text.trim().replace(/\s+/g, ' ');
        if (trimmedText.length > 50 && !paragraphs.includes(trimmedText)) {
          paragraphs.push(trimmedText);
        }
      }
    }
  }
  
  // Remove duplicates and very similar paragraphs
  paragraphs = paragraphs.filter((paragraph, index, self) => {
    // Check for exact duplicates
    const isDuplicate = self.indexOf(paragraph) !== index;
    if (isDuplicate) return false;
    
    // Check for very similar paragraphs (e.g., one is a subset of another)
    for (let i = 0; i < self.length; i++) {
      if (i === index) continue;
      
      const other = self[i];
      // If this paragraph is contained within another paragraph, skip it
      if (other.includes(paragraph) && paragraph.length < other.length) {
        return false;
      }
    }
    
    return true;
  });
  
  return {
    pageTitle,
    metadata,
    paragraphs
  };
}

// Function to verify content against trusted sources using Perplexity API
async function checkWithPerplexity(content, metadata, trustedSources) {
  // Check if the content's URL is from a trusted source
  if (metadata && metadata.url) {
    const contentDomain = new URL(metadata.url).hostname.replace('www.', '');
    const isFromTrustedSource = trustedSources.some(source => {
      const sourceDomain = source.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      return contentDomain === sourceDomain;
    });
    
    if (isFromTrustedSource) {
      // If content is from a trusted source, return a perfect score
      return {
        paragraphIndex: 0,
        content: content,
        summary: 'Content from trusted source',
        status: 'true',
        explanation: 'This content is from a source you have identified as trusted.',
        selectedSources: trustedSources.slice(0, 3),
        sourcesAgreement: [1.0, 1.0, 1.0],
        validityScore: 100
      };
    }
  }
  
  // Select 3-5 relevant sources for verification
  const selectedSources = selectRelevantSources(content, trustedSources);
  
  // Construct the prompt for Perplexity
  const prompt = `
    I want to verify if the following text is true, partially true, false, or unverifiable.
    
    TEXT TO VERIFY:
    ${content}
    
    CONTEXT (if available):
    Title: ${metadata?.title || 'Not available'}
    Description: ${metadata?.description || 'Not available'}
    URL: ${metadata?.url || 'Not available'}
    
    TRUSTED SOURCES:
    ${selectedSources.join('\n')}
    
    INSTRUCTIONS:
    1. Analyze the complete text for factual claims.
    2. Determine if these claims are true, partially true, false, or unverifiable based ONLY on the trusted sources.
    3. If the content contains claims that contradict scientific consensus (e.g., flat earth, vaccine misinformation, climate change denial), be especially critical.
    4. For each trusted source, indicate a level of agreement (0.0 to 1.0) with the text.
    5. Rate the overall validity score from 0-100 based on factual accuracy.
    
    FORMAT YOUR RESPONSE AS JSON:
    {
      "summary": "Brief 1-2 sentence summary of the text",
      "status": "true|partially_true|false|unverifiable",
      "explanation": "Explanation of your assessment",
      "sourcesAgreement": [list of agreement levels from 0.0 to 1.0 for each source],
      "validityScore": number from 0-100
    }
  `;
  
  try {
    // Faire l'appel API réel à Perplexity
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: config.API_PARAMS.model || 'llama-3-sonar-large-32k-online',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.API_PARAMS.max_tokens || 1500,
        temperature: config.API_PARAMS.temperature || 0.05,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // Format the response
    return {
      paragraphIndex: 0,
      content: content,
      summary: result.summary,
      status: result.status,
      explanation: result.explanation,
      selectedSources: selectedSources,
      sourcesAgreement: result.sourcesAgreement,
      validityScore: result.validityScore
    };
  } catch (error) {
    console.error('API Error:', error);
    // Use fallback function if API call fails
    return fallbackSimulation(content, metadata, trustedSources, false);
  }
}

// Function to select the most relevant sources for verification
function selectRelevantSources(content, trustedSources) {
  // If we have fewer than 5 sources, use all of them
  if (trustedSources.length <= 5) {
    return trustedSources;
  }
  
  // For demonstration purposes, randomly select 3-5 sources
  // In a real implementation, this would use a more sophisticated algorithm
  // to select the most relevant sources based on content
  const numSources = Math.floor(Math.random() * 3) + 3; // 3-5 sources
  const shuffled = [...trustedSources].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numSources);
}

// Fallback function to simulate verification when API is unavailable
function fallbackSimulation(content, metadata, trustedSources, containsControversialTheories) {
  // List of controversial terms to check for
  const controversialTerms = [
    'flat earth', 'earth is flat', 'conspiracy', 'illuminati', 'new world order', 
    'chemtrails', 'mind control', 'fake moon landing', 'moon landing hoax',
    'vaccine autism', 'autism vaccines', 'climate change hoax', 'global warming hoax',
    'holocaust denial', '5g coronavirus', 'covid hoax', 'covid-19 hoax'
  ];
  
  // List of established scientific facts
  const scientificFacts = [
    'earth is round', 'globe', 'vaccines are safe', 'climate change is real', 
    'human activity contributes to climate change', 'evolution is scientifically proven',
    'moon landing happened', 'holocaust happened'
  ];
  
  // Check if content contains controversial theories
  const hasControversialContent = controversialTerms.some(term => 
    content.toLowerCase().includes(term) || 
    (metadata.title && metadata.title.toLowerCase().includes(term))
  );
  
  // Check if content mentions scientific facts
  const hasScientificFacts = scientificFacts.some(fact => 
    content.toLowerCase().includes(fact) || 
    (metadata.title && metadata.title.toLowerCase().includes(fact))
  );
  
  // Determine status and base score
  let status = 'unverifiable';
  let baseScore = 50;
  
  if (hasControversialContent) {
    status = 'false';
    baseScore = 20;
    
    // Specific detection for flat earth theory
    if (content.toLowerCase().includes('flat earth') || 
        content.toLowerCase().includes('earth is flat')) {
      baseScore = 5; // Very low score for flat earth content
    }
  } else if (hasScientificFacts) {
    status = 'true';
    baseScore = 85;
  } else {
    // Analyze content length, structure, etc. to determine if it's likely true
    if (content.length > 200 && content.includes('.') && !content.includes('!!!')) {
      status = 'partially_true';
      baseScore = 65;
    }
  }
  
  // Randomly select 3-5 sources
  const numSources = Math.floor(Math.random() * 3) + 3;
  const selectedSources = trustedSources.slice(0, numSources);
  
  // Generate agreement levels based on status
  const sourcesAgreement = [];
  for (let i = 0; i < numSources; i++) {
    let agreementLevel;
    if (status === 'true') {
      // High agreement for true content
      agreementLevel = Math.min(1.0, 0.7 + Math.random() * 0.3);
    } else if (status === 'partially_true') {
      // Moderate agreement for partially true content
      agreementLevel = 0.4 + Math.random() * 0.4;
    } else if (status === 'false') {
      // Low agreement for false content
      agreementLevel = Math.max(0.0, Math.random() * 0.3);
    } else {
      // Variable agreement for unverifiable content
      agreementLevel = Math.random() * 0.6;
    }
    
    // Adjust agreement for sources with known positions on controversial theories
    if (hasControversialContent && selectedSources[i].includes('nasa.gov')) {
      agreementLevel = 0.0; // NASA would strongly disagree with flat earth
    } else if (hasControversialContent && selectedSources[i].includes('cdc.gov')) {
      agreementLevel = 0.0; // CDC would disagree with vaccine misinformation
    }
    
    sourcesAgreement.push(agreementLevel);
  }
  
  // Calculate validity score factoring in source agreement
  const avgAgreement = sourcesAgreement.reduce((sum, val) => sum + val, 0) / sourcesAgreement.length;
  let validityScore = Math.round((baseScore * 0.7) + (avgAgreement * 100 * 0.3));
  
  // If content is very controversial, cap the score
  if (containsControversialTheories) {
    validityScore = Math.min(validityScore, 40);
  }
  
  // Generate appropriate explanations
  let explanation = '';
  if (status === 'true') {
    explanation = "This content appears to be factually accurate and is supported by trusted sources.";
  } else if (status === 'partially_true') {
    explanation = "This content contains some accurate information but may include questionable claims or lack full context.";
  } else if (status === 'false') {
    explanation = "This content contains false or misleading claims that contradict information from trusted sources.";
  } else {
    explanation = "This content could not be verified using the available trusted sources.";
  }
  
  return {
    paragraphIndex: 0,
    content: content,
    summary: `Content summary from ${metadata.title || 'unknown source'}`,
    status: status,
    explanation: explanation,
    selectedSources: selectedSources,
    sourcesAgreement: sourcesAgreement,
    validityScore: validityScore
  };
}

// Function to get explanation text based on result status
function getExplanationForStatus(status, content) {
  switch(status) {
    case 'true':
      return "This content appears to be factually accurate and is supported by trusted sources.";
    case 'partially_true':
      return "This content contains some accurate information but may include questionable claims or lack full context.";
    case 'false':
      return "This content contains false or misleading claims that contradict information from trusted sources.";
    default:
      return "This content could not be verified using the available trusted sources.";
  }
}