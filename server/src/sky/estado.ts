/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lo que viaja del servidor a cada móvil, treinta veces por segundo.
 *
 * Un matamarcianos tiene en pantalla cosas que un tablero no: cien balas, veinte
 * enemigos y un jefe con partes, y todo se mueve en cada fotograma. Mandarlo con
 * nombres —`{"x":123,"y":45,"radio":4,"color":"#fff","forma":"bala"}`— son unos
 * 60 bytes por bala, que a treinta por segundo es medio megabyte por minuto solo
 * en balas. Por eso aquí todo va en listas de números, con una tabla aparte para
 * los colores y las formas, que se repiten muchísimo. Ocupa como una décima
 * parte y el móvil lo lee igual de rápido.
 *
 * Nada de esto es lógica: si algo hay que decidir, se decide en el motor.
 */

/** Redondear a un decimal llega de sobra para pintar y ahorra la mitad del texto. */
const r1 = (n: number): number => Math.round((Number(n) || 0) * 10) / 10;
const ent = (n: number): number => Math.round(Number(n) || 0);

/**
 * Junta los estilos que se repiten (color y forma) y los numera.
 *
 * Cincuenta balas del mismo arma comparten estilo: van todas con el mismo
 * número y la tabla lo explica una sola vez.
 */
class TablaDeEstilos {
  private indices = new Map<string, number>();
  readonly lista: string[] = [];

  /**
   * Los tres colores van juntos porque los dibujos del móvil usan los tres:
   * casco, sombra y acento. Mandar solo el primero dejaría a todos los enemigos
   * de un mismo gris.
   */
  indice(colores: string[] | string | undefined, forma: string): number {
    const paleta = Array.isArray(colores) ? colores : [colores ?? '#fff'];
    const tres = [paleta[0] ?? '#fff', paleta[1] ?? paleta[0] ?? '#fff', paleta[2] ?? paleta[0] ?? '#fff'];
    const clave = `${tres.join(',')}|${forma ?? 'bala'}`;

    const visto = this.indices.get(clave);
    if (visto !== undefined) return visto;

    const nuevo = this.lista.length;
    this.indices.set(clave, nuevo);
    this.lista.push(clave);
    return nuevo;
  }
}

function balas(lista: any[], estilos: TablaDeEstilos): number[][] {
  return lista.map((b) => [ent(b.x), ent(b.y), r1(b.radio), estilos.indice(b.color, b.forma)]);
}

function enemigos(lista: any[], estilos: TablaDeEstilos): number[][] {
  return lista.map((e) => [
    ent(e.x),
    ent(e.y),
    r1(e.radio),
    estilos.indice(e.colores, e.forma),
    // La vida va en porcentaje: el cliente solo la usa para el destello y la
    // barra, y así no depende de la tabla de dificultad.
    ent((e.vida / (e.vidaMax || 1)) * 100),
    e.categoria === 'jefe' ? 2 : e.categoria === 'midboss' ? 1 : 0,
  ]);
}

function jefe(j: any, estilos: TablaDeEstilos) {
  if (!j || !j.viva) return null;
  return {
    x: ent(j.x),
    y: ent(j.y),
    r: r1(j.radio),
    e: estilos.indice(j.colores, j.forma),
    nombre: j.nombre,
    fase: j.faseIndice,
    entrando: Boolean(j.entrando),
    vida: ent((j.vida / (j.vidaFase || j.vidaTotal || 1)) * 100),
    total: ent((j.vida / (j.vidaTotal || 1)) * 100),
    partes: (j.partes ?? [])
      .filter((p: any) => p.viva)
      .map((p: any) => [ent(p.x), ent(p.y), r1(p.radio ?? 14), ent((p.vida / (p.vidaMax || 1)) * 100)]),
  };
}

/**
 * El estado completo de un fotograma.
 *
 * Se manda entero cada vez, sin diferencias respecto al anterior: un móvil que
 * pierde un paquete se recupera solo en el siguiente, que es lo que hace falta
 * en un juego donde todo se mueve. Guardar diferencias obligaría a reenviar lo
 * perdido y a llevar la cuenta de qué sabe cada cliente.
 */
export function instantanea(match: any) {
  const p = match.partida;
  if (!p) return null;

  const estilos = new TablaDeEstilos();

  return {
    f: match.fotograma,
    // Qué vuelo es: el fotograma solo se puede comparar dentro del mismo.
    vuelo: match.generacion,
    t: r1(p.tiempo),
    vidas: p.vidas,
    puntos: ent(p.puntos),
    stage: match.stageIndice,

    j: p.jugadores.map((j: any) => [
      j.indice,
      ent(j.x),
      ent(j.y),
      j.vivo ? 1 : 0,
      j.invulnerable > 0 ? 1 : 0,
      j.nivel,
      j.bombas,
      r1(j.inclinacion),
      j.disparando ? 1 : 0,
      ent(j.bajas),
    ]),

    bj: balas(p.balasJugador, estilos),
    be: balas(p.balasEnemigo, estilos),
    en: enemigos(p.enemigos, estilos),
    jf: jefe(p.jefe, estilos),
    pu: p.powerups.map((u: any) => [ent(u.x), ent(u.y), u.tipo]),
    es: p.escudos.map((s: any) => [ent(s.x1), ent(s.y1), ent(s.x2), ent(s.y2)]),

    // Marcadores de la ruta del guerrero, que el HUD enseña mientras se juega.
    gen: p.generados,
    des: p.destruidos,
    ins: p.insignia ? 1 : 0,
    perd: p.vidasPerdidas,

    anuncio: p.anuncio ? p.anuncio.texto : null,
    zona: p.zona ? p.zona.nombre : null,
    combinado: p.combinadoActivo > 0 ? 1 : 0,
    viento: r1(p.viento),

    est: estilos.lista,
  };
}

/** La lista de la sala: quién está, qué lleva y si ya ha elegido. */
export function lobby(match: any) {
  return {
    code: match.id,
    estado: match.estado,
    stage: match.stageIndice,
    host: match.hostToken,
    puedeEmpezar: match.puedeEmpezar,
    ocupadas: match.ocupadas,
    pilotos: match.pilotos.map((p: any) => ({
      indice: p.indice,
      nombre: p.nombre,
      paisId: p.paisId,
      naveIndice: p.naveIndice,
      listo: p.listo,
      conectado: p.socketId !== null,
    })),
  };
}
