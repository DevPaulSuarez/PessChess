/**
 * Naves personalizadas: sustituir el dibujo de una nave por el tuyo.
 *
 * Es la pieza que pedía el diseño como crítica, así que tiene que ser tonta de
 * usar: sueltas un PNG encima de la pantalla y ya estás volando con él. No hay
 * que reiniciar, ni tocar carpetas, ni tener un servidor delante.
 *
 * Se guarda en `localStorage` en vez de en disco porque el juego corre en el
 * navegador: así la nave sigue ahí la próxima vez sin pedir permisos de nada.
 * Quien prefiera dejar los ficheros en `assets/custom_ships/` también puede
 * (ver `cargarDeCarpeta`).
 */

const CLAVE = 'sky.naves';
const LADO = 64; // el tamaño que fija el documento para cada fotograma

/** Cache en memoria: convertir un dataURL en imagen cuesta, y se pinta 60 veces por segundo. */
const imagenes = new Map();

function todas() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
  } catch {
    return {};
  }
}

export function leer(ranura) {
  return todas()[ranura] ?? null;
}

export function guardar(ranura, nave) {
  const mapa = todas();
  mapa[ranura] = nave;
  localStorage.setItem(CLAVE, JSON.stringify(mapa));
  imagenes.delete(ranura);
}

export function borrar(ranura) {
  const mapa = todas();
  delete mapa[ranura];
  localStorage.setItem(CLAVE, JSON.stringify(mapa));
  imagenes.delete(ranura);
}

/** La imagen ya lista para pintar, o null si esa ranura usa la nave de serie. */
export function imagenDe(ranura) {
  if (imagenes.has(ranura)) return imagenes.get(ranura);

  const nave = leer(ranura);
  if (!nave) return null;

  const img = new Image();
  img.src = nave.datos;
  imagenes.set(ranura, img);
  return img;
}

/**
 * Lee un PNG o JPG que el jugador acaba de soltar.
 *
 * Si no trae metadatos de hoja de sprites, la imagen se reescala a 64x64
 * respetando la proporción y centrada: así vale cualquier foto sin recortar
 * nada a mano. Si sí los trae, se deja intacta, porque tocar una hoja de
 * sprites descuadraría todos sus fotogramas.
 */
export function cargarArchivo(archivo, meta = null) {
  return new Promise((resolver, rechazar) => {
    if (!archivo.type.startsWith('image/')) {
      rechazar(new Error('Eso no es una imagen'));
      return;
    }

    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el fichero'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error('La imagen está corrupta'));
      img.onload = () => {
        if (meta) {
          resolver({ datos: lector.result, meta, ancho: img.width, alto: img.height });
          return;
        }
        resolver({ datos: encajarEn64(img), meta: null, ancho: LADO, alto: LADO });
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function encajarEn64(img) {
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');

  const escala = Math.min(LADO / img.width, LADO / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, (LADO - w) / 2, (LADO - h) / 2, w, h);

  return lienzo.toDataURL('image/png');
}

/**
 * Valida los metadatos de una hoja de sprites.
 *
 * Se comprueba aquí y no al dibujar porque un error en el JSON tiene que salir
 * en el editor, con un mensaje que se entienda, y no como un parpadeo raro en
 * mitad de una partida.
 */
export function validarMeta(texto) {
  let meta;
  try {
    meta = JSON.parse(texto);
  } catch {
    throw new Error('El JSON no se entiende');
  }

  const { frame_width: ancho, frame_height: alto, frames, animations: animaciones } = meta;
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    throw new Error('Faltan frame_width y frame_height');
  }
  if (!Number.isFinite(frames) || frames <= 0) throw new Error('Falta el número de frames');
  if (!animaciones || typeof animaciones !== 'object') throw new Error('Faltan las animations');

  for (const [nombre, lista] of Object.entries(animaciones)) {
    if (!Array.isArray(lista) || lista.some((n) => !Number.isInteger(n) || n < 0 || n >= frames)) {
      throw new Error(`La animación "${nombre}" apunta a fotogramas que no existen`);
    }
  }
  return meta;
}

/** El fotograma que toca de una animación, en bucle. */
export function fotogramaDe(meta, animacion, t, fps = 12) {
  const lista = meta?.animations?.[animacion] ?? meta?.animations?.idle;
  if (!lista || lista.length === 0) return 0;
  return lista[Math.floor(t * fps) % lista.length];
}

/**
 * Pinta la nave del jugador con su imagen, centrada en el origen del contexto.
 * Devuelve false si esa ranura no tiene nada y hay que dibujar la de serie.
 */
export function dibujarPersonalizada(ctx, ranura, opciones = {}) {
  const nave = leer(ranura);
  const img = imagenDe(ranura);
  if (!nave || !img?.complete || img.naturalWidth === 0) return false;

  const { escala = 34, animacion = 'idle', t = 0, tinte = null } = opciones;

  if (nave.meta) {
    const { frame_width: fw, frame_height: fh } = nave.meta;
    const indice = fotogramaDe(nave.meta, animacion, t);
    const porFila = Math.max(1, Math.floor(img.naturalWidth / fw));
    const sx = (indice % porFila) * fw;
    const sy = Math.floor(indice / porFila) * fh;
    ctx.drawImage(img, sx, sy, fw, fh, -escala / 2, -escala / 2, escala, escala);
  } else {
    ctx.drawImage(img, -escala / 2, -escala / 2, escala, escala);
  }

  // Velo del color del país: mantiene la identidad visual del equipo aunque
  // cada jugador traiga un dibujo de su cosecha.
  if (tinte) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = tinte;
    ctx.fillRect(-escala / 2, -escala / 2, escala, escala);
    ctx.restore();
  }
  return true;
}

/**
 * Intenta cargar una nave desde `assets/custom_ships/<nombre>/ship_idle.png`.
 *
 * Es el camino que describe el documento para quien prefiera dejar los ficheros
 * en disco. Si la carpeta no existe no pasa nada: se devuelve null y se usa la
 * nave de serie.
 */
export async function cargarDeCarpeta(nombre) {
  try {
    const base = `assets/custom_ships/${nombre}`;
    const respuesta = await fetch(`${base}/ship_idle.png`, { cache: 'no-cache' });
    if (!respuesta.ok) return null;

    const blob = await respuesta.blob();
    let meta = null;
    const metaRespuesta = await fetch(`${base}/sprite.json`, { cache: 'no-cache' });
    if (metaRespuesta.ok) meta = validarMeta(await metaRespuesta.text());

    return await cargarArchivo(new File([blob], 'ship_idle.png', { type: blob.type }), meta);
  } catch {
    return null;
  }
}
