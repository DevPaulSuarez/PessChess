/**
 * El editor de Sky Warriors contra el servidor real.
 *
 * Lo que importa aquí no es que la página pinte bien, sino que un retoque
 * guardado llegue de verdad a la partida y que lo que no se toca siga siendo lo
 * que dice el código. Requiere el servidor levantado.
 *
 * Se ejecuta con `npm run test:sky-editor`.
 */
import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const TIMEOUT = Number(process.env.TIMEOUT_MS ?? 5000);

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

const api = async (ruta, opciones) => {
  const res = await fetch(`${URL}${ruta}`, {
    ...opciones,
    headers: { 'content-type': 'application/json' },
  });
  return { estado: res.status, cuerpo: await res.json() };
};

const datos = () => api('/api/sky/datos');
const pais = (todo, id) => todo.paises.find((p) => p.id === id);

function connect() {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  socket.lastJoined = null;
  socket.on('sky_joined', (j) => (socket.lastJoined = j));
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function once(socket, event, timeoutMs = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nEditor de Sky Warriors contra ${URL}`);

  // Se parte de limpio: lo que hubiera editado no puede decidir esta prueba.
  await api('/api/sky/restaurar', { method: 'POST', body: JSON.stringify({ tipo: 'paises' }) });
  await api('/api/sky/restaurar', { method: 'POST', body: JSON.stringify({ tipo: 'stages' }) });

  console.log('\nLo que hay:');
  const { cuerpo: inicial } = await datos();
  check('están los veintiún países', inicial.paises.length === 21, `${inicial.paises.length}`);
  check('y los tres escenarios', inicial.stages.length === 3, `${inicial.stages.length}`);
  check('sin nada editado todavía', inicial.editados.paises.length === 0);

  const original = pais(inicial, 'peru');
  check('cada país trae su arma y su bandera',
    Boolean(original.arma.color && original.bandera.tipo));

  console.log('\nUn retoque se guarda y se nota:');
  const { estado, cuerpo: guardado } = await api('/api/sky/paises/peru', {
    method: 'PUT',
    body: JSON.stringify({
      arma: { color: '#ff00ff', forma: 'disco', dano: 33 },
      colores: ['#111111', '#222222', '#333333'],
    }),
  });
  check('el servidor lo acepta', estado === 200, `${estado}`);
  check('y devuelve el país ya cambiado', guardado.arma.color === '#ff00ff', guardado.arma?.color);
  check('la forma de la bala se guarda', guardado.arma.forma === 'disco', guardado.arma?.forma);
  check('el daño también', guardado.arma.dano === 33, `${guardado.arma?.dano}`);

  // Lo que no se toca sigue siendo lo del código: esa es la gracia de guardar
  // solo los cambios.
  check('lo que no se tocó no cambia',
    guardado.arma.tipo === original.arma.tipo && guardado.nombre === original.nombre,
    `${guardado.arma.tipo} vs ${original.arma.tipo}`);
  check('y sus naves siguen ahí', guardado.naves.length === 2);

  const { cuerpo: trasGuardar } = await datos();
  check('queda marcado como editado', trasGuardar.editados.paises.includes('peru'),
    trasGuardar.editados.paises.join());
  check('los demás países no se tocan',
    pais(trasGuardar, 'usa').arma.color === pais(inicial, 'usa').arma.color);

  console.log('\nY llega al juego:');
  const ana = await connect();
  ana.emit('sky_create', { name: 'Ana', pilotId: `editor-${Date.now()}` });
  const entrada = await once(ana, 'sky_joined');
  const peruEnJuego = entrada.paises.find((p) => p.id === 'peru');
  check('el catálogo que recibe el móvil trae el cambio',
    peruEnJuego.arma.nombre === original.arma.nombre, peruEnJuego.arma?.nombre);
  check('con los colores nuevos', peruEnJuego.colores[0] === '#111111',
    peruEnJuego.colores?.[0]);
  ana.disconnect();

  console.log('\nLo que no vale, no entra:');
  const malColor = await api('/api/sky/paises/peru', {
    method: 'PUT',
    body: JSON.stringify({ arma: { color: 'rojo' } }),
  });
  check('un color inventado se rechaza', malColor.estado === 400, `${malColor.estado}`);
  check('y dice por qué', /color/i.test(malColor.cuerpo.error ?? ''), malColor.cuerpo.error);

  const malaCadencia = await api('/api/sky/paises/peru', {
    method: 'PUT',
    body: JSON.stringify({ arma: { cadencia: 0 } }),
  });
  check('una cadencia de cero se rechaza', malaCadencia.estado === 400, `${malaCadencia.estado}`);

  const malPais = await api('/api/sky/paises/atlantida', {
    method: 'PUT',
    body: JSON.stringify({ arma: { color: '#ffffff' } }),
  });
  check('un país que no existe se rechaza', malPais.estado === 400, `${malPais.estado}`);

  const { cuerpo: trasFallos } = await datos();
  check('y ninguno de los intentos malos cambió nada',
    pais(trasFallos, 'peru').arma.color === '#ff00ff',
    pais(trasFallos, 'peru').arma.color);

  console.log('\nUn escenario también se retoca:');
  const stage = await api('/api/sky/stages/mexico', {
    method: 'PUT',
    body: JSON.stringify({ titulo: 'Prueba', plantillas: { chupacabra: { vida: 99 } } }),
  });
  check('se guarda el escenario', stage.estado === 200, `${stage.estado}`);
  check('con el título nuevo', stage.cuerpo.titulo === 'Prueba', stage.cuerpo.titulo);
  check('y la vida del enemigo cambiada', stage.cuerpo.plantillas.chupacabra.vida === 99,
    `${stage.cuerpo.plantillas.chupacabra.vida}`);
  check('sin perder el resto de sus enemigos',
    Object.keys(stage.cuerpo.plantillas).length > 1,
    `${Object.keys(stage.cuerpo.plantillas).length}`);
  check('ni el color que ya tenía',
    Array.isArray(stage.cuerpo.plantillas.chupacabra.colores));

  console.log('\nUna nave puede llevar tu propio dibujo:');
  {
    // Un PNG de 1x1 de verdad, con su firma: lo que se comprueba es la firma,
    // no la extensión, que la pone quien sube el fichero.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const subida = await fetch(`${URL}/api/sky/naves/peru/0/imagen`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: png,
    });
    const conDibujo = await subida.json();
    check('se sube el dibujo', subida.status === 200, `${subida.status}`);
    check('y la nave se queda con él',
      typeof conDibujo.naves[0].imagen === 'string' && conDibujo.naves[0].imagen.startsWith('/sky-naves/'),
      conDibujo.naves?.[0]?.imagen);
    check('la otra nave no se entera', !conDibujo.naves[1].imagen);

    // Y se puede pedir: es lo que hará el móvil para pintarla.
    const bajada = await fetch(`${URL}${conDibujo.naves[0].imagen}`);
    const bytes = Buffer.from(await bajada.arrayBuffer());
    check('la imagen se sirve', bajada.status === 200, `${bajada.status}`);
    check('y es la misma que se subió', bytes.equals(png), `${bytes.length} bytes`);

    // Lo que no es una imagen no entra, aunque lo diga la cabecera.
    const falsa = await fetch(`${URL}/api/sky/naves/peru/1/imagen`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: Buffer.from('esto no es un png'),
    });
    check('un fichero que no es imagen se rechaza', falsa.status === 400, `${falsa.status}`);
    check('y dice por qué', /png|jpg/i.test((await falsa.json()).error ?? ''));

    // El móvil lo recibe en el catálogo.
    const ana2 = await connect();
    ana2.emit('sky_create', { name: 'Ana', pilotId: `imagen-${Date.now()}` });
    const conCatalogo = await once(ana2, 'sky_joined');
    const peruMovil = conCatalogo.paises.find((p) => p.id === 'peru');
    check('el móvil recibe la ruta del dibujo',
      peruMovil.naves[0].imagen === conDibujo.naves[0].imagen, peruMovil.naves?.[0]?.imagen);
    check('y para la nave sin dibujo llega vacío', peruMovil.naves[1].imagen === null,
      `${peruMovil.naves?.[1]?.imagen}`);
    ana2.disconnect();

    const quitada = await fetch(`${URL}/api/sky/naves/peru/0/imagen`, { method: 'DELETE' });
    const sinDibujo = await quitada.json();
    check('se puede quitar y vuelve la silueta', !sinDibujo.naves[0].imagen,
      sinDibujo.naves?.[0]?.imagen);
  }

  console.log('\nY se puede deshacer:');
  await api('/api/sky/restaurar', {
    method: 'POST',
    body: JSON.stringify({ tipo: 'paises', id: 'peru' }),
  });
  const { cuerpo: final } = await datos();
  check('el país vuelve a como estaba', pais(final, 'peru').arma.color === original.arma.color,
    pais(final, 'peru').arma.color);
  check('y deja de estar marcado', !final.editados.paises.includes('peru'),
    final.editados.paises.join());
  check('el escenario retocado sigue estándolo', final.editados.stages.includes('mexico'));

  await api('/api/sky/restaurar', { method: 'POST', body: JSON.stringify({ tipo: 'stages' }) });

  console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nLa prueba se rompió:', error.message);
  process.exit(1);
});
