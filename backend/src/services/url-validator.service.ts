import axios, { AxiosError } from 'axios';
import { URLCheckResult } from '../types/index.js';
import { config } from '../config/index.js';

export class URLValidatorService {
  private timeout: number;

  constructor() {
    this.timeout = config.validation.urlCheckTimeout;
  }

  async checkUrl(url: string): Promise<URLCheckResult> {
    const result: URLCheckResult = {
      url,
      accessible: false,
      hasRateLimit: false,
    };

    const startTime = Date.now();

    try {
      // Primero intentamos HEAD para obtener headers sin descargar el contenido
      const headResponse = await axios.head(url, {
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Aceptar 4xx para detectar rate limiting
      });

      result.responseTime = Date.now() - startTime;
      result.statusCode = headResponse.status;

      // Verificar si es accesible
      if (headResponse.status >= 200 && headResponse.status < 300) {
        result.accessible = true;
      } else if (headResponse.status === 403 || headResponse.status === 401) {
        result.accessible = false;
        result.error = `Acceso denegado (${headResponse.status})`;
      } else if (headResponse.status === 404) {
        result.accessible = false;
        result.error = 'Recurso no encontrado (404)';
      } else if (headResponse.status === 429) {
        result.accessible = false;
        result.hasRateLimit = true;
        result.error = 'Rate limit excedido (429)';
      }

      // Extraer información de headers
      const headers = headResponse.headers;

      // Content-Type
      result.contentType = headers['content-type']?.split(';')[0];

      // Content-Length (tamaño del archivo)
      const contentLength = headers['content-length'];
      if (contentLength) {
        result.contentLength = parseInt(contentLength, 10);
      }

      // Detectar rate limiting
      this.detectRateLimiting(headers, result);

      // Si es un video, intentar obtener duración y resolución
      if (result.accessible && this.isVideoContentType(result.contentType)) {
        await this.getVideoMetadata(url, result);
      }
    } catch (error) {
      result.responseTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          result.error = `Timeout después de ${this.timeout}ms`;
        } else if (axiosError.code === 'ENOTFOUND') {
          result.error = 'Dominio no encontrado (DNS)';
        } else if (axiosError.code === 'ECONNREFUSED') {
          result.error = 'Conexión rechazada';
        } else if (axiosError.response) {
          result.statusCode = axiosError.response.status;
          result.error = `Error HTTP ${axiosError.response.status}`;

          // Verificar rate limiting en respuesta de error
          this.detectRateLimiting(axiosError.response.headers as Record<string, string>, result);
        } else {
          result.error = axiosError.message;
        }
      } else {
        result.error = error instanceof Error ? error.message : 'Error desconocido';
      }
    }

    return result;
  }

  async checkUrls(urls: string[], concurrency: number = 5): Promise<URLCheckResult[]> {
    const results: URLCheckResult[] = [];
    const queue = [...urls];

    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (url) {
          const result = await this.checkUrl(url);
          results.push(result);
        }
      }
    };

    // Ejecutar en paralelo con límite de concurrencia
    const workers = Array(Math.min(concurrency, urls.length))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    // Ordenar resultados por URL original
    return urls.map((url) => results.find((r) => r.url === url)!);
  }

  private detectRateLimiting(headers: Record<string, string>, result: URLCheckResult): void {
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'x-rate-limit-limit',
      'x-rate-limit-remaining',
      'x-rate-limit-reset',
      'retry-after',
    ];

    const foundHeaders: Record<string, string> = {};

    for (const header of rateLimitHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) {
        foundHeaders[header] = value;
      }
    }

    if (Object.keys(foundHeaders).length > 0) {
      result.hasRateLimit = true;
      result.rateLimitInfo = {
        limit: this.extractNumber(foundHeaders, ['x-ratelimit-limit', 'ratelimit-limit', 'x-rate-limit-limit']),
        remaining: this.extractNumber(foundHeaders, ['x-ratelimit-remaining', 'ratelimit-remaining', 'x-rate-limit-remaining']),
        resetTime: this.extractNumber(foundHeaders, ['x-ratelimit-reset', 'ratelimit-reset', 'x-rate-limit-reset', 'retry-after']),
      };
    }
  }

  private extractNumber(headers: Record<string, string>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = headers[key];
      if (value) {
        const num = parseInt(value, 10);
        if (!isNaN(num)) return num;
      }
    }
    return undefined;
  }

  private isVideoContentType(contentType?: string): boolean {
    if (!contentType) return false;
    return (
      contentType.startsWith('video/') ||
      contentType === 'application/x-mpegURL' ||
      contentType === 'application/dash+xml' ||
      contentType === 'application/vnd.apple.mpegurl'
    );
  }

  private async getVideoMetadata(url: string, result: URLCheckResult): Promise<void> {
    try {
      // Para videos directos (mp4, etc.), intentamos obtener más información
      // a través de un GET parcial (primeros bytes) para obtener headers

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          Range: 'bytes=0-1024', // Solo primeros 1KB para metadata
        },
        responseType: 'arraybuffer',
        maxRedirects: 5,
      });

      // Actualizar content-length si viene en Content-Range
      const contentRange = response.headers['content-range'];
      if (contentRange) {
        // Format: bytes 0-1024/total
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          result.contentLength = parseInt(match[1], 10);
        }
      }

      // Para HLS/DASH, parseamos el manifiesto para obtener resoluciones
      if (url.endsWith('.m3u8') || result.contentType === 'application/x-mpegURL') {
        await this.parseHLSManifest(url, result);
      }
    } catch {
      // No es crítico si falla obtener metadata adicional
    }
  }

  private async parseHLSManifest(url: string, result: URLCheckResult): Promise<void> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        responseType: 'text',
      });

      const manifest = response.data as string;

      // Buscar resoluciones en el manifiesto
      const resolutions: string[] = [];
      const resolutionRegex = /RESOLUTION=(\d+x\d+)/g;
      let match;

      while ((match = resolutionRegex.exec(manifest)) !== null) {
        resolutions.push(match[1]);
      }

      if (resolutions.length > 0) {
        // Ordenar por calidad (mayor primero)
        resolutions.sort((a, b) => {
          const aHeight = parseInt(a.split('x')[1], 10);
          const bHeight = parseInt(b.split('x')[1], 10);
          return bHeight - aHeight;
        });

        result.resolution = resolutions[0]; // Mayor resolución disponible
      }

      // Intentar obtener duración (si hay tag #EXT-X-TARGETDURATION o #EXTINF)
      const durationMatch = manifest.match(/#EXT-X-TARGETDURATION:(\d+)/);
      if (durationMatch) {
        // Esta es la duración de segmento, no total
        // Para duración total necesitaríamos sumar todos los #EXTINF
      }

      // Contar segmentos y estimar duración
      const extinfMatches = manifest.match(/#EXTINF:([\d.]+)/g);
      if (extinfMatches) {
        let totalDuration = 0;
        for (const extinf of extinfMatches) {
          const durMatch = extinf.match(/#EXTINF:([\d.]+)/);
          if (durMatch) {
            totalDuration += parseFloat(durMatch[1]);
          }
        }
        if (totalDuration > 0) {
          result.duration = Math.round(totalDuration);
        }
      }
    } catch {
      // Ignorar errores al parsear manifiesto
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
