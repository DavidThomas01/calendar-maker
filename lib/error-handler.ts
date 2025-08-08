/**
 * Enhanced error handling utilities for the comments system
 */

export interface ApiErrorResponse {
  error: string;
  details?: string;
  timestamp?: string;
}

export interface ErrorDetails {
  userMessage: string;
  technicalMessage: string;
  shouldRetry: boolean;
  errorCode?: string;
}

/**
 * Parse API error response and provide user-friendly and technical details
 */
export function parseApiError(error: unknown, operation: string): ErrorDetails {
  // Default error details
  let userMessage = `Error al ${operation}`;
  let technicalMessage = 'Unknown error occurred';
  let shouldRetry = false;
  let errorCode: string | undefined;

  try {
    if (error instanceof Response) {
      // HTTP Response error
      errorCode = `HTTP_${error.status}`;
      
      switch (error.status) {
        case 400:
          userMessage = `Error de validación al ${operation}`;
          technicalMessage = 'Bad request - check input data';
          shouldRetry = false;
          break;
        case 404:
          userMessage = `Comentario no encontrado al ${operation}`;
          technicalMessage = 'Resource not found';
          shouldRetry = false;
          break;
        case 500:
          userMessage = `Error del servidor al ${operation}. Inténtalo de nuevo.`;
          technicalMessage = 'Internal server error';
          shouldRetry = true;
          break;
        case 503:
          userMessage = `Servicio temporalmente no disponible. Inténtalo en unos minutos.`;
          technicalMessage = 'Service unavailable';
          shouldRetry = true;
          break;
        default:
          userMessage = `Error de conexión al ${operation}`;
          technicalMessage = `HTTP ${error.status}: ${error.statusText}`;
          shouldRetry = error.status >= 500;
      }
    } else if (error instanceof Error) {
      // JavaScript Error object
      technicalMessage = error.message;
      
      if (error.message.includes('Failed to fetch')) {
        userMessage = `Error de conexión al ${operation}. Verifica tu conexión a internet.`;
        shouldRetry = true;
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('NetworkError')) {
        userMessage = `Error de red al ${operation}. Inténtalo de nuevo.`;
        shouldRetry = true;
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('timeout')) {
        userMessage = `Tiempo de espera agotado al ${operation}. Inténtalo de nuevo.`;
        shouldRetry = true;
        errorCode = 'TIMEOUT_ERROR';
      } else {
        userMessage = `Error técnico al ${operation}: ${error.message}`;
        shouldRetry = false;
        errorCode = 'TECHNICAL_ERROR';
      }
    } else if (typeof error === 'string') {
      technicalMessage = error;
      userMessage = `Error al ${operation}: ${error}`;
    }
  } catch (parseError) {
    console.error('Error parsing API error:', parseError);
    technicalMessage = 'Error parsing failed';
  }

  return {
    userMessage,
    technicalMessage,
    shouldRetry,
    errorCode
  };
}

/**
 * Enhanced fetch with better error handling
 */
export async function apiRequest<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Parse response body
    let responseData: any;
    try {
      responseData = await response.json();
    } catch {
      responseData = { error: 'Invalid response format' };
    }

    if (!response.ok) {
      // Create enhanced error with response data
      const error = new Error(responseData.error || `HTTP ${response.status}`);
      (error as any).response = response;
      (error as any).responseData = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    // Re-throw with additional context
    if (error instanceof Error) {
      (error as any).url = url;
      (error as any).options = options;
    }
    throw error;
  }
}

/**
 * Display error message with option to show technical details
 */
export function displayError(
  errorDetails: ErrorDetails, 
  showTechnicalDetails: boolean = true
): void {
  let message = errorDetails.userMessage;
  
  if (showTechnicalDetails && errorDetails.technicalMessage) {
    message += `\n\nDetalles técnicos: ${errorDetails.technicalMessage}`;
    
    if (errorDetails.errorCode) {
      message += `\nCódigo de error: ${errorDetails.errorCode}`;
    }
  }
  
  if (errorDetails.shouldRetry) {
    message += '\n\n¿Quieres intentar de nuevo?';
    
    if (confirm(message)) {
      // Return true to indicate retry should be attempted
      return;
    }
  } else {
    alert(message);
  }
}

/**
 * Retry wrapper for async operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        console.log(`Retrying operation (attempt ${attempt + 2}/${maxRetries + 1})...`);
      }
    }
  }
  
  throw lastError;
}

/**
 * Log error details for debugging
 */
export function logError(
  operation: string,
  error: unknown,
  context?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    operation,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  };
  
  console.error('Error Log:', errorLog);
  
  // In production, you might want to send this to an error tracking service
  // For now, we'll just log to console
}