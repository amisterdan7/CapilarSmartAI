/**
 * Utilitário de Processamento, Otimização e Preservação de Fidelidade Clínica
 * Capilar Smart IA — Fase 4
 * 
 * Diretrizes Clínicas Obrigatórias:
 * 1. O arquivo original NUNCA é descartado automaticamente: é preservado de forma íntegra para
 *    análise de microscopia e tricoscopia.
 * 2. WebP com qualidade alta (0.92) é gerado para visualização rápida sem substituir a garantia
 *    do arquivo original não-comprimido.
 * 3. Miniatura (thumbnail) de 300x300 gerada para carregamento veloz em timelines e grids.
 * 4. Higienização de privacidade LGPD: a reconstrução via HTML5 Canvas descarta metadados
 *    EXIF confidenciais (GPS, números de série e dados técnicos da câmera).
 */

import { PhotoCategory } from '../types';

export interface ProcessedImagePackage {
  originalBlob: Blob;
  originalExtension: string;
  originalSizeBytes: number;
  
  optimizedBlob: Blob;
  optimizedSizeBytes: number;
  width: number;
  height: number;
  
  thumbnailBlob: Blob;
  thumbnailSizeBytes: number;
  
  isOriginalPreserved: boolean;
  notes?: string;
}

/**
 * Lê um File ou Blob como HTMLImageElement de forma assíncrona.
 */
const loadImageElement = (blobOrFile: Blob | File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blobOrFile);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao renderizar a imagem no elemento de decodificação.'));
    };
    img.src = url;
  });
};

/**
 * Converte um elemento Canvas para Blob WebP com fallback para JPEG caso o browser não suporte WebP no canvas.
 */
const canvasToBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
  preferredType: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback caso toBlob falhe
          try {
            const dataUrl = canvas.toDataURL(preferredType, quality);
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mimeString }));
          } catch (e) {
            reject(new Error('Falha ao extrair dados binários do Canvas.'));
          }
        }
      },
      preferredType,
      quality
    );
  });
};

/**
 * Detecta a extensão do arquivo original a partir do MIME type.
 */
export const getOriginalExtension = (file: File | Blob): string => {
  if (file instanceof File && file.name) {
    const parts = file.name.split('.');
    if (parts.length > 1) {
      return parts.pop()!.toLowerCase();
    }
  }
  switch (file.type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return 'jpg';
  }
};

/**
 * Processa uma fotografia clínica para arquivo e acompanhamento:
 * - Preserva o binário original intocado
 * - Gera versão otimizada com nitidez clínica preservada
 * - Gera thumbnail de 300x300
 * - Elimina EXIF de privacidade
 */
export const processClinicalImage = async (
  fileOrBlob: File | Blob,
  category: PhotoCategory
): Promise<ProcessedImagePackage> => {
  const originalBlob = fileOrBlob;
  const originalSizeBytes = fileOrBlob.size;
  const originalExtension = getOriginalExtension(fileOrBlob);

  const img = await loadImageElement(fileOrBlob);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  // Definição dos limites de dimensão e qualidade de acordo com a categoria
  let maxDimension = 1920;
  let targetQuality = 0.85;

  if (category === 'TRICOSCOPIA_COURO' || category === 'TRICOSCOPIA_HASTE') {
    // Microscopia: Preservação de resolução nativa até 2048px e qualidade 0.92
    maxDimension = 2048;
    targetQuality = 0.92;
  } else if (category === 'VISAGISMO_ROSTO' || category === 'PANORAMICA_CABELO') {
    maxDimension = 1920;
    targetQuality = 0.85;
  }

  // Cálculo proporcional das dimensões da imagem otimizada
  let optWidth = srcWidth;
  let optHeight = srcHeight;

  if (srcWidth > maxDimension || srcHeight > maxDimension) {
    if (srcWidth >= srcHeight) {
      optWidth = maxDimension;
      optHeight = Math.round((srcHeight * maxDimension) / srcWidth);
    } else {
      optHeight = maxDimension;
      optWidth = Math.round((srcWidth * maxDimension) / srcHeight);
    }
  }

  // 1. Renderização da Imagem Otimizada
  const optCanvas = document.createElement('canvas');
  optCanvas.width = optWidth;
  optCanvas.height = optHeight;
  const optCtx = optCanvas.getContext('2d', { alpha: false });
  if (!optCtx) throw new Error('Não foi possível obter o contexto 2D do Canvas.');

  // Melhora a interpolação para preservar detalhes finos de escamas
  optCtx.imageSmoothingEnabled = true;
  optCtx.imageSmoothingQuality = 'high';
  optCtx.drawImage(img, 0, 0, optWidth, optHeight);

  const optimizedBlob = await canvasToBlob(optCanvas, targetQuality, 'image/webp');

  // 2. Renderização da Miniatura (Thumbnail 300x300 quadrada recortada ao centro)
  const thumbSize = 300;
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbSize;
  thumbCanvas.height = thumbSize;
  const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
  if (!thumbCtx) throw new Error('Não foi possível obter o contexto 2D do Canvas para miniatura.');

  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = 'medium';

  const minDim = Math.min(srcWidth, srcHeight);
  const sx = (srcWidth - minDim) / 2;
  const sy = (srcHeight - minDim) / 2;

  thumbCtx.drawImage(img, sx, sy, minDim, minDim, 0, 0, thumbSize, thumbSize);
  const thumbnailBlob = await canvasToBlob(thumbCanvas, 0.75, 'image/webp');

  return {
    originalBlob,
    originalExtension,
    originalSizeBytes,
    optimizedBlob,
    optimizedSizeBytes: optimizedBlob.size,
    width: optWidth,
    height: optHeight,
    thumbnailBlob,
    thumbnailSizeBytes: thumbnailBlob.size,
    isOriginalPreserved: true,
  };
};

/**
 * Converte Blob para URL temporária para visualização na interface.
 */
export const createBlobPreviewUrl = (blob: Blob): string => {
  return URL.createObjectURL(blob);
};
