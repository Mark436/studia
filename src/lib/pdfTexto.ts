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
 * prehorario, programación, …): en dev pasa por el proxy de vite (mismo
 * origen) y en producción va directo a `ith.mx`.
 */
export function urlDocumentoPdf(archivo: string): string {
  const ruta = `/documentos/${encodeURIComponent(archivo)}`;

  return import.meta.env.DEV ? ruta : `https://ith.mx${ruta}`;
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