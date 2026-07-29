/**
 * Todo lo que se dibuja a mano: naves, banderas y utilidades de texto.
 *
 * No hay ni un PNG en el juego base. Las naves son polígonos y las banderas son
 * rectángulos, así que se ven nítidas a cualquier escala, pesan cero y —lo que
 * importa de verdad— el jugador puede sustituir cualquiera de ellas por su
 * propio dibujo sin que falte nada (ver `sistemas/naves-custom.js`).
 */

/** Siluetas en una caja de lado 1 centrada en el origen, con el morro arriba. */
const SILUETAS = {
  caza: {
    fuselaje: [[0, -0.5], [0.08, -0.24], [0.09, 0.3], [-0.09, 0.3], [-0.08, -0.24]],
    alas: [[0.08, -0.02], [0.46, 0.2], [0.46, 0.28], [0.08, 0.2]],
    cola: [[0.06, 0.26], [0.24, 0.44], [0.24, 0.5], [0.06, 0.4]],
    cabina: [0, -0.16, 0.06, 0.11],
  },
  raptor: {
    fuselaje: [[0, -0.5], [0.13, -0.1], [0.12, 0.32], [-0.12, 0.32], [-0.13, -0.1]],
    alas: [[0.11, -0.06], [0.5, 0.24], [0.42, 0.34], [0.11, 0.26]],
    cola: [[0.13, 0.24], [0.3, 0.48], [0.2, 0.5], [0.08, 0.36]],
    cabina: [0, -0.2, 0.07, 0.1],
  },
  canard: {
    // Delta con canards: el morro lleva dos aletitas por delante del ala.
    fuselaje: [[0, -0.5], [0.07, -0.18], [0.1, 0.34], [-0.1, 0.34], [-0.07, -0.18]],
    alas: [[0.08, -0.08], [0.44, 0.3], [0.44, 0.36], [0.08, 0.28]],
    canard: [[0.06, -0.28], [0.26, -0.12], [0.26, -0.07], [0.06, -0.16]],
    cola: [[0.05, 0.3], [0.16, 0.48], [0.16, 0.5], [0.05, 0.42]],
    cabina: [0, -0.24, 0.055, 0.1],
  },
  interceptor: {
    fuselaje: [[0, -0.5], [0.09, -0.3], [0.1, 0.36], [-0.1, 0.36], [-0.09, -0.3]],
    alas: [[0.09, 0.02], [0.48, 0.26], [0.48, 0.32], [0.09, 0.24]],
    cola: [[0.09, 0.28], [0.3, 0.46], [0.3, 0.5], [0.09, 0.42]],
    cabina: [0, -0.24, 0.06, 0.12],
  },
  ataque: {
    // Avión de ataque: corto, ancho y con pinta de aguantar lo que le echen.
    fuselaje: [[0, -0.44], [0.13, -0.2], [0.14, 0.32], [-0.14, 0.32], [-0.13, -0.2]],
    alas: [[0.12, -0.04], [0.5, 0.02], [0.5, 0.16], [0.12, 0.18]],
    cola: [[0.1, 0.28], [0.3, 0.4], [0.3, 0.48], [0.1, 0.42]],
    cabina: [0, -0.2, 0.07, 0.1],
  },
  ligero: {
    fuselaje: [[0, -0.46], [0.08, -0.26], [0.08, 0.32], [-0.08, 0.32], [-0.08, -0.26]],
    alas: [[0.07, 0.0], [0.44, 0.06], [0.44, 0.16], [0.07, 0.18]],
    cola: [[0.06, 0.3], [0.22, 0.38], [0.22, 0.46], [0.06, 0.42]],
    cabina: [0, -0.2, 0.055, 0.1],
  },
  helice: {
    fuselaje: [[0, -0.42], [0.1, -0.22], [0.1, 0.34], [-0.1, 0.34], [-0.1, -0.22]],
    alas: [[0.09, 0.04], [0.46, 0.1], [0.46, 0.2], [0.09, 0.22]],
    cola: [[0.08, 0.3], [0.26, 0.4], [0.26, 0.48], [0.08, 0.44]],
    cabina: [0, -0.12, 0.06, 0.12],
    helice: true,
  },
  bimotor: {
    // Dos colas unidas por un plano, como un Bronco.
    fuselaje: [[0, -0.42], [0.09, -0.2], [0.09, 0.16], [-0.09, 0.16], [-0.09, -0.2]],
    alas: [[0.08, -0.06], [0.5, 0.0], [0.5, 0.12], [0.08, 0.14]],
    barquilla: [[0.24, -0.1], [0.34, -0.1], [0.34, 0.46], [0.24, 0.46]],
    travesano: [[-0.34, 0.4], [0.34, 0.4], [0.34, 0.5], [-0.34, 0.5]],
    cabina: [0, -0.14, 0.06, 0.1],
  },
};

export function siluetasDisponibles() {
  return Object.keys(SILUETAS);
}

function poligono(ctx, puntos, escala, espejo = false) {
  ctx.beginPath();
  for (const [px, py] of puntos) {
    const x = (espejo ? -px : px) * escala;
    ctx.lineTo(x, py * escala);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Dibuja una nave centrada en el origen del contexto.
 *
 * `inclinacion` va de -1 a 1 y estrecha la silueta al virar, que es como se
 * simulaba el alabeo en las recreativas de 16 bits: sin sprites nuevos.
 */
export function dibujarNave(ctx, silueta, colores, opciones = {}) {
  const { escala = 34, inclinacion = 0, t = 0, propulsor = true } = opciones;
  const forma = SILUETAS[silueta] ?? SILUETAS.caza;
  const [primario, secundario, acento] = colores;

  ctx.save();
  ctx.scale(1 - Math.abs(inclinacion) * 0.35, 1);
  ctx.rotate(inclinacion * 0.12);

  if (propulsor) {
    // Llama detrás, con un parpadeo rápido para que se note el motor vivo.
    const largo = (0.16 + Math.abs(Math.sin(t * 26)) * 0.1) * escala;
    const gradiente = ctx.createLinearGradient(0, 0.32 * escala, 0, 0.32 * escala + largo);
    gradiente.addColorStop(0, acento);
    gradiente.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradiente;
    ctx.fillRect(-0.05 * escala, 0.3 * escala, 0.1 * escala, largo);
  }

  ctx.fillStyle = secundario;
  if (forma.travesano) poligono(ctx, forma.travesano, escala);
  for (const parte of ['alas', 'canard', 'cola', 'barquilla']) {
    if (!forma[parte]) continue;
    poligono(ctx, forma[parte], escala);
    poligono(ctx, forma[parte], escala, true);
  }

  ctx.fillStyle = primario;
  poligono(ctx, forma.fuselaje, escala);

  if (forma.helice) {
    // El disco de la hélice: un óvalo translúcido que gira demasiado deprisa
    // para verse, como en la realidad.
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.ellipse(0, -0.36 * escala, 0.3 * escala, 0.05 * escala, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const [cx, cy, rx, ry] = forma.cabina;
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.ellipse(cx * escala, cy * escala, rx * escala, ry * escala, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Banderas
// ---------------------------------------------------------------------------

/**
 * Banderas simplificadas: franjas y poco más.
 *
 * No se busca exactitud heráldica —a 40 píxeles no cabe un escudo— sino que
 * cada país se reconozca de un vistazo en la parrilla del selector.
 */
export function dibujarBandera(ctx, pais, x, y, w, h) {
  const b = pais.bandera;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  const franjas = (dir) => {
    const pesos = b.pesos ?? b.franjas.map(() => 1);
    const total = pesos.reduce((a, n) => a + n, 0);
    let avance = 0;
    b.franjas.forEach((color, i) => {
      const parte = (pesos[i] / total) * (dir === 'h' ? h : w);
      ctx.fillStyle = color;
      if (dir === 'h') ctx.fillRect(x, y + avance, w, parte + 0.5);
      else ctx.fillRect(x + avance, y, parte + 0.5, h);
      avance += parte;
    });
  };

  switch (b.tipo) {
    case 'h':
    case 'v':
      franjas(b.tipo);
      if (b.emblema) {
        ctx.fillStyle = b.emblema;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'usa': {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#b22234' : '#ffffff';
        ctx.fillRect(x, y + (i * h) / 7, w, h / 7 + 0.5);
      }
      ctx.fillStyle = '#3c3b6e';
      ctx.fillRect(x, y, w * 0.42, h * 0.54);
      ctx.fillStyle = '#ffffff';
      for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 4; c++) {
          estrella(ctx, x + w * 0.08 + c * w * 0.09, y + h * 0.14 + f * h * 0.16, h * 0.05);
        }
      }
      break;
    }

    case 'china':
      ctx.fillStyle = '#de2910';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffde00';
      estrella(ctx, x + w * 0.22, y + h * 0.32, h * 0.16);
      for (let i = 0; i < 4; i++) {
        estrella(ctx, x + w * 0.42, y + h * 0.12 + i * h * 0.15, h * 0.06);
      }
      break;

    case 'cuba': {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#002a8f' : '#ffffff';
        ctx.fillRect(x, y + (i * h) / 5, w, h / 5 + 0.5);
      }
      ctx.fillStyle = '#cf142b';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.42, y + h / 2);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      estrella(ctx, x + w * 0.13, y + h / 2, h * 0.13);
      break;
    }

    case 'cruz':
      ctx.fillStyle = '#002d62';
      ctx.fillRect(x, y, w / 2, h / 2);
      ctx.fillRect(x + w / 2, y + h / 2, w / 2, h / 2);
      ctx.fillStyle = '#ce1126';
      ctx.fillRect(x + w / 2, y, w / 2, h / 2);
      ctx.fillRect(x, y + h / 2, w / 2, h / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w * 0.44, y, w * 0.12, h);
      ctx.fillRect(x, y + h * 0.44, w, h * 0.12);
      break;

    case 'chile':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h / 2);
      ctx.fillStyle = '#d52b1e';
      ctx.fillRect(x, y + h / 2, w, h / 2);
      ctx.fillStyle = '#0039a6';
      ctx.fillRect(x, y, w / 3, h / 2);
      ctx.fillStyle = '#ffffff';
      estrella(ctx, x + w / 6, y + h / 4, h * 0.14);
      break;

    case 'panama':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#005293';
      ctx.fillRect(x + w / 2, y, w / 2, h / 2);
      ctx.fillStyle = '#da121a';
      ctx.fillRect(x, y + h / 2, w / 2, h / 2);
      ctx.fillStyle = '#005293';
      estrella(ctx, x + w * 0.25, y + h * 0.25, h * 0.12);
      ctx.fillStyle = '#da121a';
      estrella(ctx, x + w * 0.75, y + h * 0.75, h * 0.12);
      break;

    default:
      franjas('h');
  }

  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function estrella(ctx, x, y, radio, puntas = 5) {
  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.45;
    const a = (i * Math.PI) / puntas - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Texto y cajas
// ---------------------------------------------------------------------------

export function texto(ctx, cadena, x, y, opciones = {}) {
  const {
    tam = 12,
    color = '#f0ece8',
    alineado = 'left',
    peso = '700',
    sombra = true,
  } = opciones;

  ctx.font = `${peso} ${tam}px "Trebuchet MS", "DejaVu Sans", sans-serif`;
  ctx.textAlign = alineado;
  ctx.textBaseline = 'alphabetic';

  if (sombra) {
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillText(cadena, x + 1, y + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(cadena, x, y);
}

export function caja(ctx, x, y, w, h, opciones = {}) {
  const { relleno = 'rgba(10,8,7,.72)', borde = null, radio = 6, grosor = 2 } = opciones;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radio);
  if (relleno) {
    ctx.fillStyle = relleno;
    ctx.fill();
  }
  if (borde) {
    ctx.strokeStyle = borde;
    ctx.lineWidth = grosor;
    ctx.stroke();
  }
}

/** Barra de vida o de progreso, con su marco. */
export function barra(ctx, x, y, w, h, fraccion, color) {
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraccion)), h);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
