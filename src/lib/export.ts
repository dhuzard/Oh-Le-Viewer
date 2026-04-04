import type { PersistedViewerState } from '../types/ontology';

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportLayoutJson(state: PersistedViewerState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'ontology-layout.ohle-layout.json');
}

export function importLayoutJson(file: File): Promise<PersistedViewerState> {
  return file.text().then((content) => JSON.parse(content) as PersistedViewerState);
}

export function exportSvgElement(element: SVGSVGElement, fileName: string): void {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(element);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, fileName);
}

export async function exportSvgElementAsPng(element: SVGSVGElement, fileName: string): Promise<void> {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(element);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to render SVG as PNG.'));
      nextImage.src = url;
    });

    const viewBox = element.viewBox.baseVal;
    const width = viewBox && viewBox.width ? viewBox.width : element.clientWidth || 1600;
    const height = viewBox && viewBox.height ? viewBox.height : element.clientHeight || 1100;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas export is not available in this browser.');
    }

    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }
        reject(new Error('Unable to encode PNG export.'));
      }, 'image/png');
    });

    downloadBlob(pngBlob, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}