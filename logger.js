// Système de journalisation pour l'extension WebCheck
// Ce fichier est inclus dans le contrôle de version Git (mais pas les logs générés)

// Nom du fichier de log actuel
const LOG_FILENAME = `webcheck-api-errors-${new Date().toISOString().slice(0, 10)}.log`;

// Fonction pour écrire dans un fichier de log local
export function logApiError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error.message || 'Unknown error';
  const stackTrace = error.stack || '';
  
  // Formatage du message de log
  const logEntry = {
    timestamp,
    type: 'API_ERROR',
    message: errorMessage,
    context,
    stackTrace
  };
  
  const logMessage = JSON.stringify(logEntry, null, 2);
  
  // Stocker dans le stockage local de Chrome (pour consultation interne)
  chrome.storage.local.get(['apiErrorLogs'], function(result) {
    const logs = result.apiErrorLogs || [];
    logs.push(logEntry);
    
    // Limiter le nombre de logs stockés (garder les 100 derniers)
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    
    chrome.storage.local.set({ apiErrorLogs: logs });
    console.error('[API ERROR LOGGED]', logEntry);
    
    // Écrire également dans un fichier physique
    appendToLogFile(logMessage + "\n\n");
  });
  
  // Également écrire dans la console pour le débogage
  console.error(`[API ERROR] ${timestamp}: ${errorMessage}`, context);
}

// Fonction pour ajouter du contenu au fichier de log
function appendToLogFile(content) {
  // Récupérer le fichier de log actuel s'il existe
  chrome.storage.local.get(['currentLogFileContent'], function(result) {
    let currentContent = result.currentLogFileContent || '';
    
    // Ajouter le nouveau contenu
    currentContent += content;
    
    // Sauvegarder le contenu mis à jour
    chrome.storage.local.set({ currentLogFileContent: currentContent });
    
    // Sauvegarder également la date de dernière mise à jour
    chrome.storage.local.set({ 
      lastLogUpdate: new Date().toISOString(),
      lastLogFilename: LOG_FILENAME
    });
  });
}

// Fonction pour récupérer les logs d'erreurs
export function getApiErrorLogs(callback) {
  chrome.storage.local.get(['apiErrorLogs'], function(result) {
    callback(result.apiErrorLogs || []);
  });
}

// Fonction pour effacer les logs
export function clearApiErrorLogs(callback) {
  chrome.storage.local.set({ 
    apiErrorLogs: [],
    currentLogFileContent: '',
    lastLogUpdate: null
  }, callback);
}

// Fonction pour exporter les logs dans un fichier
export function exportApiErrorLogs() {
  // Récupérer le contenu du fichier de log actuel
  chrome.storage.local.get(['currentLogFileContent', 'apiErrorLogs'], function(result) {
    // Si nous avons du contenu dans le stockage local, l'utiliser
    if (result.currentLogFileContent) {
      downloadLogFile(result.currentLogFileContent, LOG_FILENAME);
    } 
    // Sinon, générer un nouveau fichier à partir des logs en mémoire
    else if (result.apiErrorLogs && result.apiErrorLogs.length > 0) {
      const content = result.apiErrorLogs.map(log => JSON.stringify(log, null, 2)).join("\n\n");
      downloadLogFile(content, LOG_FILENAME);
    }
    // Si aucun log n'est disponible
    else {
      alert("Aucun log d'erreur API n'est disponible pour l'exportation.");
    }
  });
}

// Fonction pour télécharger le fichier de log
function downloadLogFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Fonction pour ouvrir le fichier de log actuel
export function openCurrentLogFile() {
  chrome.storage.local.get(['currentLogFileContent'], function(result) {
    if (result.currentLogFileContent) {
      // Créer un blob et ouvrir dans une nouvelle fenêtre/onglet
      const blob = new Blob([result.currentLogFileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Libérer l'URL lorsque la page est fermée
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } else {
      alert("Aucun fichier de log n'est disponible pour le moment.");
    }
  });
} 