// La lectura del PDF usa `pdfjs-dist`, que pesa mucho: se importa de forma
// dinámica dentro de `leerTextoPDF` para no inflar el bundle principal.
// El resto de este módulo no depende de pdfjs.

// El worker se referencia como chunk propio (asset aparte, no en el JS
// principal). Vite lo empaqueta con `?worker&url` en formato ES, porque
// pdfjs v6 crea el worker como módulo (`new Worker(src, { type: "module" })`);
// la ruta cruda del paquete (`?url`) no se sirve bien en dev.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";

/**
 * URL para descargar un PDF del repositorio del instituto (calendario,
 * prehorario, programación, …): en dev y producción pasa por el proxy
 * de Netlify Function `/api/ith/` para evitar CORS.
 */
export function urlDocumentoPdf(archivo: string): string {
  const ruta = `/documentos/${encodeURIComponent(archivo)}`;

  return `/api/ith${ruta}`;
}

/**
 * Descarga un PDF y devuelve su texto plano (una línea por página). Sirve para
 * cualquier documento del instituto; cada consumidor interpreta el texto como
 * sea necesario (fechas del calendario, tablas del prehorario, …).
 */
export async function leerTextoPDF(url: string): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerUrl;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const documento = await getDocument({ data }).promise;

  let texto = "";
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const contenido = await pagina.getTextContent();
    texto +=
      contenido.items
        .map(item => ("str" in item ? item.str : ""))
        .join(" ") + "\n";
  }

  return texto;
}

/** Celda de texto con su posición horizontal (en puntos del PDF). */
export interface CeldaPDF {
  x: number;
  texto: string;
}

/** Renglón de una página: celdas que comparten la misma coordenada vertical. */
export interface RenglonPDF {
  y: number;
  celdas: CeldaPDF[];
}

/** Página leída con sus renglones ordenados de arriba hacia abajo. */
export interface PaginaRenglones {
  numero: number;
  renglones: RenglonPDF[];
}

/**
 * Descarga un PDF y devuelve su contenido con POSICIONES (x, y). El texto plano
 * (`leerTextoPDF`) pierde la estructura de columnas de las tablas del
 * prehorario; conservar coordenadas permite reconstruir las celdas por columna.
 */
export async function leerRenglonesPDF(url: string): Promise<PaginaRenglones[]> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerUrl;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const documento = await getDocument({ data }).promise;

  const paginas: PaginaRenglones[] = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const contenido = await pagina.getTextContent();

    const porRenglon = new Map<number, CeldaPDF[]>();
    for (const item of contenido.items) {
      if (!("str" in item)) continue;
      const texto = item.str;
      if (!texto.trim()) continue;

      const x = item.transform[4] ?? 0;
      const y = Math.round(item.transform[5] ?? 0);

      const celdas = porRenglon.get(y) ?? [];
      celdas.push({ x, texto });
      porRenglon.set(y, celdas);
    }

    paginas.push({
      numero: i,
      renglones: [...porRenglon.entries()]
        .map(([y, celdas]) => ({ y, celdas }))
        .sort((a, b) => b.y - a.y),
    });
  }

  return paginas;
}