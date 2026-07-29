import { dibujarNave, dibujarBandera, siluetasDisponibles } from './motor/core/pintor.js';

/**
 * Editor de países, naves, balas, banderas y escenarios.
 *
 * La vista previa usa el mismo pintor que el juego, así que lo que se ve aquí
 * es exactamente lo que se verá volando. Lo que se manda al servidor es solo lo
 * que has cambiado, no el país entero: así lo que no tocas sigue siendo lo que
 * dice el código, y restaurar es borrar el retoque.
 */

const $ = (id) => document.getElementById(id);
const lista = $('lista');
const panel = $('panel');

let datos = { paises: [], stages: [], editados: { paises: [], stages: [] } };
let pestana = 'paises';
let seleccionado = null;

/** Lo editado en el formulario, antes de guardar. */
let borrador = {};

// ---------------------------------------------------------------------------

async function cargar() {
  const res = await fetch('/api/sky/datos');
  datos = await res.json();
  if (!seleccionado) seleccionado = datos.paises[0]?.id ?? null;
  pintarLista();
  pintarPanel();
}

function actual() {
  const donde = pestana === 'paises' ? datos.paises : datos.stages;
  return donde.find((x) => x.id === seleccionado) ?? donde[0];
}

function pintarLista() {
  const cosas = pestana === 'paises' ? datos.paises : datos.stages;
  const editados = datos.editados[pestana] ?? [];
  $('tituloLista').textContent = pestana === 'paises' ? 'Países' : 'Escenarios';

  lista.innerHTML = '';
  for (const cosa of cosas) {
    const li = document.createElement('li');
    li.textContent = cosa.nombre ?? cosa.lugar ?? cosa.id;
    if (cosa.id === seleccionado) li.className = 'activo';
    if (editados.includes(cosa.id)) {
      const marca = document.createElement('span');
      marca.className = 'marca';
      marca.textContent = 'editado';
      li.appendChild(marca);
    }
    li.onclick = () => {
      seleccionado = cosa.id;
      borrador = {};
      pintarLista();
      pintarPanel();
    };
    lista.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------

/** Mete un valor en el borrador respetando la forma anidada del dato. */
function anota(ruta, valor) {
  const partes = ruta.split('.');
  let nodo = borrador;
  for (let i = 0; i < partes.length - 1; i++) {
    const p = /^\d+$/.test(partes[i + 1]) ? [] : {};
    nodo[partes[i]] ??= Array.isArray(p) ? [] : {};
    nodo = nodo[partes[i]];
  }
  nodo[partes.at(-1)] = valor;
}

/** Las naves viajan siempre las dos, porque una lista a medias no significa nada. */
function anotaNave(indice, campo, valor) {
  const pais = actual();
  borrador.naves ??= pais.naves.map((n) => ({ ...n }));
  borrador.naves[indice][campo] = valor;
}

function campo(etiqueta, valor, alCambiar, { tipo = 'text', paso, min, max } = {}) {
  const cont = document.createElement('div');
  const lab = document.createElement('label');
  lab.textContent = etiqueta;
  const inp = document.createElement('input');
  inp.type = tipo;
  inp.value = valor ?? '';
  if (paso !== undefined) inp.step = paso;
  if (min !== undefined) inp.min = min;
  if (max !== undefined) inp.max = max;
  inp.oninput = () => {
    alCambiar(tipo === 'number' ? Number(inp.value) : inp.value);
    pintarVistas();
  };
  cont.append(lab, inp);
  return cont;
}

function seleccion(etiqueta, valor, opciones, alCambiar) {
  const cont = document.createElement('div');
  const lab = document.createElement('label');
  lab.textContent = etiqueta;
  const sel = document.createElement('select');
  for (const op of opciones) {
    const o = document.createElement('option');
    o.value = op;
    o.textContent = op;
    if (op === valor) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    alCambiar(sel.value);
    pintarVistas();
  };
  cont.append(lab, sel);
  return cont;
}

function grupo(titulo, hijos) {
  const fs = document.createElement('fieldset');
  const lg = document.createElement('legend');
  lg.textContent = titulo;
  fs.append(lg, ...hijos);
  return fs;
}

function fila(hijos) {
  const div = document.createElement('div');
  div.className = 'fila';
  div.append(...hijos);
  return div;
}

// ---------------------------------------------------------------------------

/** Las que el motor sabe pintar; no vale inventarse otras. */
const FORMAS_BALA = ['esfera', 'misil', 'lanza', 'rayo', 'plasma', 'disco', 'pluma'];
const TIPOS_ARMA = [
  'recto', 'abanico', 'guiado', 'plasma', 'penetrante',
  'rayo', 'rebote', 'onda', 'enjambre', 'fragmenta',
];
const TIPOS_BOMBA = ['pantalla', 'barrido', 'escudo', 'columna', 'lluvia'];
const TIPOS_BANDERA = ['h', 'v', 'usa', 'china', 'cuba', 'cruz', 'chile', 'panama'];

function pintarPanel() {
  panel.innerHTML = '';
  const cosa = actual();
  if (!cosa) return;

  panel.appendChild(vistas());

  if (pestana === 'paises') pintarPais(cosa);
  else pintarStage(cosa);

  const acciones = document.createElement('div');
  acciones.className = 'acciones';

  const guardar = document.createElement('button');
  guardar.textContent = 'Guardar';
  guardar.onclick = () => enviar(cosa.id);

  const restaurar = document.createElement('button');
  restaurar.className = 'suave';
  restaurar.textContent = 'Volver al original';
  restaurar.onclick = () => restablecer(cosa.id);

  acciones.append(guardar, restaurar);
  panel.appendChild(acciones);

  const aviso = document.createElement('div');
  aviso.id = 'aviso';
  panel.appendChild(aviso);

  pintarVistas();
}

function pintarPais(pais) {
  const colores = pais.colores;

  panel.appendChild(grupo('Colores del país', [
    fila([0, 1, 2].map((i) =>
      campo(['Principal', 'Sombra', 'Acento'][i], colores[i], (v) => {
        borrador.colores ??= [...colores];
        borrador.colores[i] = v;
      }, { tipo: 'color' }),
    )),
  ]));

  const b = pais.bandera ?? { tipo: 'h', franjas: [] };
  const hijosBandera = [
    seleccion('Tipo', b.tipo, TIPOS_BANDERA, (v) => anota('bandera.tipo', v)),
  ];
  if (b.tipo === 'h' || b.tipo === 'v') {
    const franjas = b.franjas ?? [];
    hijosBandera.push(fila(franjas.map((f, i) =>
      campo(`Franja ${i + 1}`, f, (v) => {
        borrador.bandera ??= {};
        borrador.bandera.franjas ??= [...franjas];
        borrador.bandera.franjas[i] = v;
      }, { tipo: 'color' }),
    )));
    hijosBandera.push(campo('Emblema (opcional)', b.emblema ?? '#000000',
      (v) => anota('bandera.emblema', v), { tipo: 'color' }));
  }
  panel.appendChild(grupo('Bandera', hijosBandera));

  const arma = pais.arma;
  panel.appendChild(grupo('Arma y balas', [
    campo('Nombre', arma.nombre, (v) => anota('arma.nombre', v)),
    seleccion('Tipo de disparo', arma.tipo, TIPOS_ARMA, (v) => anota('arma.tipo', v)),
    fila([
      campo('Color de la bala', arma.color, (v) => anota('arma.color', v), { tipo: 'color' }),
      seleccion('Forma de la bala', arma.forma ?? 'esfera', FORMAS_BALA,
        (v) => anota('arma.forma', v)),
    ]),
    fila([
      campo('Cadencia (s)', arma.cadencia, (v) => anota('arma.cadencia', v),
        { tipo: 'number', paso: '0.01', min: '0.05', max: '2' }),
      campo('Daño', arma.dano, (v) => anota('arma.dano', v),
        { tipo: 'number', paso: '1', min: '1', max: '500' }),
    ]),
  ]));

  const bomba = pais.bomba;
  panel.appendChild(grupo('Bomba', [
    campo('Nombre', bomba.nombre, (v) => anota('bomba.nombre', v)),
    fila([
      seleccion('Tipo', bomba.tipo, TIPOS_BOMBA, (v) => anota('bomba.tipo', v)),
      campo('Color', bomba.color ?? '#ffffff', (v) => anota('bomba.color', v), { tipo: 'color' }),
    ]),
  ]));

  const siluetas = siluetasDisponibles();
  pais.naves.forEach((nave, i) => {
    panel.appendChild(grupo(`Nave ${i + 1}`, [
      campo('Nombre', nave.nombre, (v) => anotaNave(i, 'nombre', v)),
      campo('Piloto', nave.piloto, (v) => anotaNave(i, 'piloto', v)),
      seleccion('Silueta', nave.silueta, siluetas, (v) => anotaNave(i, 'silueta', v)),
      fila([
        campo('Velocidad', nave.velocidad, (v) => anotaNave(i, 'velocidad', v),
          { tipo: 'number', paso: '1', min: '1', max: '5' }),
        campo('Poder', nave.poder, (v) => anotaNave(i, 'poder', v),
          { tipo: 'number', paso: '1', min: '1', max: '5' }),
        campo('Bombas', nave.bombas, (v) => anotaNave(i, 'bombas', v),
          { tipo: 'number', paso: '1', min: '0', max: '6' }),
      ]),
      dibujoPropio(pais.id, i, nave),
    ]));
  });
}

function pintarStage(stage) {
  panel.appendChild(grupo('El escenario', [
    campo('Título', stage.titulo, (v) => anota('titulo', v)),
    campo('Lugar', stage.lugar, (v) => anota('lugar', v)),
    campo('Ambiente', stage.ambiente, (v) => anota('ambiente', v)),
    seleccion('Fondo', stage.fondo, ['ciudad', 'selva', 'hielo', 'mar', 'desierto'],
      (v) => anota('fondo', v)),
  ]));

  for (const [nombre, p] of Object.entries(stage.plantillas ?? {})) {
    panel.appendChild(grupo(`Enemigo: ${nombre}`, [
      fila([
        campo('Vida', p.vida, (v) => anota(`plantillas.${nombre}.vida`, v),
          { tipo: 'number', paso: '1', min: '1' }),
        campo('Puntos', p.puntos, (v) => anota(`plantillas.${nombre}.puntos`, v),
          { tipo: 'number', paso: '10', min: '0' }),
        campo('Radio', p.radio, (v) => anota(`plantillas.${nombre}.radio`, v),
          { tipo: 'number', paso: '1', min: '4' }),
      ]),
      fila((p.colores ?? []).map((c, i) =>
        campo(`Color ${i + 1}`, c, (v) => {
          borrador.plantillas ??= {};
          borrador.plantillas[nombre] ??= {};
          borrador.plantillas[nombre].colores ??= [...p.colores];
          borrador.plantillas[nombre].colores[i] = v;
        }, { tipo: 'color' }),
      )),
      ...(p.disparo
        ? [fila([
            campo('Color de sus balas', p.disparo.color,
              (v) => anota(`plantillas.${nombre}.disparo.color`, v), { tipo: 'color' }),
            campo('Cada (s)', p.disparo.cada,
              (v) => anota(`plantillas.${nombre}.disparo.cada`, v),
              { tipo: 'number', paso: '0.1', min: '0.2' }),
          ])]
        : []),
    ]));
  }
}

/**
 * Subir un dibujo propio para una nave.
 *
 * Va aparte del resto del formulario porque no espera al botón de guardar: un
 * fichero se sube en cuanto se elige, y así se ve al momento si ha quedado bien.
 */
function dibujoPropio(paisId, indice, nave) {
  const cont = document.createElement('div');

  const lab = document.createElement('label');
  lab.textContent = 'Dibujo propio (PNG o JPG, hasta 600 kB)';
  cont.appendChild(lab);

  if (nave.imagen) {
    const vista = document.createElement('img');
    vista.src = nave.imagen;
    vista.alt = '';
    vista.style.cssText =
      'display:block;max-width:120px;max-height:90px;margin:6px 0;' +
      'background:#070a18;border-radius:6px;border:1px solid var(--borde)';
    cont.appendChild(vista);
  }

  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'image/png,image/jpeg';
  entrada.onchange = async () => {
    const fichero = entrada.files?.[0];
    if (!fichero) return;
    await subirImagen(paisId, indice, fichero);
  };
  cont.appendChild(entrada);

  if (nave.imagen) {
    const quitar = document.createElement('button');
    quitar.className = 'suave';
    quitar.textContent = 'Quitar el dibujo';
    quitar.style.marginTop = '8px';
    quitar.onclick = async () => {
      await fetch(`/api/sky/naves/${paisId}/${indice}/imagen`, { method: 'DELETE' });
      await cargar();
    };
    cont.appendChild(quitar);
  }

  return cont;
}

async function subirImagen(paisId, indice, fichero) {
  const aviso = $('aviso');
  const res = await fetch(`/api/sky/naves/${paisId}/${indice}/imagen`, {
    method: 'PUT',
    headers: { 'content-type': fichero.type },
    body: fichero,
  });
  const cuerpo = await res.json();

  if (!res.ok) {
    aviso.className = 'mal';
    aviso.textContent = cuerpo.error ?? 'No se pudo subir la imagen.';
    return;
  }

  aviso.className = 'bien';
  aviso.textContent = 'Dibujo subido. Vale desde la partida siguiente.';
  await cargar();
}

// ---------------------------------------------------------------------------
// Vista previa, con el pintor del juego
// ---------------------------------------------------------------------------

function vistas() {
  const div = document.createElement('div');
  div.className = 'vistas';
  div.innerHTML = `
    <canvas class="vista" id="vistaNave" width="150" height="120"></canvas>
    <canvas class="vista" id="vistaBandera" width="150" height="120"></canvas>
    <canvas class="vista" id="vistaBalas" width="150" height="120"></canvas>
  `;
  return div;
}

/** Lo que se está viendo: el original con el borrador pegado encima. */
function conBorrador() {
  const pegar = (base, encima) => {
    if (Array.isArray(encima)) return encima;
    if (encima === null || typeof encima !== 'object') return encima ?? base;
    const out = { ...(base ?? {}) };
    for (const [k, v] of Object.entries(encima)) out[k] = pegar(out[k], v);
    return out;
  };
  return pegar(actual(), borrador);
}

function pintarVistas() {
  if (pestana !== 'paises') return;
  const pais = conBorrador();

  const nave = document.getElementById('vistaNave')?.getContext('2d');
  if (nave) {
    nave.clearRect(0, 0, 150, 120);
    const propia = pais.naves[0].imagen;
    if (propia) {
      const img = new Image();
      img.onload = () => {
        const escala = 60 / Math.max(img.width, img.height);
        nave.drawImage(img, 75 - (img.width * escala) / 2, 60 - (img.height * escala) / 2,
          img.width * escala, img.height * escala);
      };
      img.src = propia;
    } else {
      nave.save();
      nave.translate(75, 60);
      dibujarNave(nave, pais.naves[0].silueta, pais.colores, { escala: 40 });
      nave.restore();
    }
  }

  const bandera = document.getElementById('vistaBandera')?.getContext('2d');
  if (bandera) {
    bandera.clearRect(0, 0, 150, 120);
    dibujarBandera(bandera, pais, 25, 35, 100, 60);
  }

  const balas = document.getElementById('vistaBalas')?.getContext('2d');
  if (balas) {
    balas.clearRect(0, 0, 150, 120);
    balas.fillStyle = pais.arma.color;
    // Tres balas subiendo, como se ven al disparar.
    for (let i = 0; i < 3; i++) {
      const x = 45 + i * 30;
      const y = 30 + (i % 2) * 24;
      pintarBala(balas, pais.arma.forma ?? 'esfera', x, y);
    }
    balas.fillStyle = '#98a0c8';
    balas.font = '11px system-ui';
    balas.textAlign = 'center';
    balas.fillText(`${pais.arma.tipo} · ${pais.arma.forma ?? 'la del arma'}`, 75, 105);
  }
}

function pintarBala(ctx, forma, x, y) {
  ctx.beginPath();
  switch (forma) {
    case 'misil':
      ctx.rect(x - 2, y - 7, 4, 14);
      break;
    case 'lanza':
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 4, y + 6);
      ctx.lineTo(x - 4, y + 6);
      break;
    case 'rayo':
      ctx.rect(x - 3, y - 14, 6, 28);
      break;
    case 'plasma':
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      break;
    case 'disco':
      ctx.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2);
      break;
    case 'pluma':
      ctx.ellipse(x, y, 4, 9, 0, 0, Math.PI * 2);
      break;
    default:
      ctx.arc(x, y, 5, 0, Math.PI * 2);
  }
  ctx.fill();
}

// ---------------------------------------------------------------------------

async function enviar(id) {
  const aviso = $('aviso');
  if (Object.keys(borrador).length === 0) {
    aviso.className = '';
    aviso.textContent = 'No has cambiado nada todavía.';
    return;
  }

  const res = await fetch(`/api/sky/${pestana}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(borrador),
  });
  const cuerpo = await res.json();

  if (!res.ok) {
    aviso.className = 'mal';
    aviso.textContent = cuerpo.error ?? 'No se pudo guardar.';
    return;
  }

  aviso.className = 'bien';
  aviso.textContent = 'Guardado. Vale desde la partida siguiente.';
  borrador = {};
  await cargar();
}

async function restablecer(id) {
  await fetch('/api/sky/restaurar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: pestana, id }),
  });
  borrador = {};
  await cargar();
  $('aviso').className = 'bien';
  $('aviso').textContent = 'Restaurado a como está en el código.';
}

// ---------------------------------------------------------------------------

$('tabPaises').onclick = () => cambiarPestana('paises', $('tabPaises'), $('tabStages'));
$('tabStages').onclick = () => cambiarPestana('stages', $('tabStages'), $('tabPaises'));

function cambiarPestana(cual, activo, otro) {
  pestana = cual;
  borrador = {};
  seleccionado = (cual === 'paises' ? datos.paises : datos.stages)[0]?.id ?? null;
  activo.className = 'activo';
  otro.className = '';
  pintarLista();
  pintarPanel();
}

cargar();
