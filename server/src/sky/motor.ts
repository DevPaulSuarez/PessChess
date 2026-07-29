/**
 * El motor de Sky Warriors, cargado en el servidor.
 *
 * Vive en `sky-motor/`, en JavaScript suelto, porque nació siendo el juego del
 * navegador y ya estaba entero y probado cuando se llevó a la red. No lleva
 * nada del navegador dentro —las comprobaciones de `test:sky-sim` lo juegan
 * entero en Node contra un lienzo de mentira—, así que se carga tal cual en vez
 * de escribir un segundo motor que habría que mantener en paralelo y que se
 * desviaría del primero a la primera semana.
 *
 * Lo único que hace falta ponerle es un altavoz mudo: el motor avisa de cada
 * disparo y cada explosión, y en el servidor no hay a quién.
 */

/**
 * La ruta sale igual desde `src/sky/` (con `tsx`) que desde `dist/sky/` (con
 * `node`): las dos están a dos niveles de `server/`. Se construye en tiempo de
 * ejecución a propósito, para que TypeScript no intente resolver un `.js` sin
 * tipos y para que no acabe copiado dentro de `dist/`.
 */
function rutaMotor(fichero: string): string {
  return new URL(`../../sky-motor/${fichero}`, import.meta.url).href;
}

/** El motor no tiene tipos: entra como `any` y se acota en `match.ts`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Modulo = any;

let cargado: {
  Partida: Modulo;
  STAGES: Modulo[];
  PAIS_POR_ID: Record<string, Modulo>;
  PASO: number;
  ANCHO: number;
  ALTO: number;
} | null = null;

/**
 * Carga el motor una sola vez y lo deja en memoria.
 *
 * Se hace a mano en vez de con `import` de arriba porque la ruta se construye
 * en ejecución; el resultado se cachea, así que la primera sala paga la carga y
 * las demás no.
 */
export async function cargarMotor() {
  if (cargado) return cargado;

  const [partida, stages, paises, constantes] = await Promise.all([
    import(rutaMotor('juego/partida.js')) as Promise<Modulo>,
    import(rutaMotor('datos/stages.js')) as Promise<Modulo>,
    import(rutaMotor('datos/paises.js')) as Promise<Modulo>,
    import(rutaMotor('core/constantes.js')) as Promise<Modulo>,
  ]);

  cargado = {
    Partida: partida.Partida,
    STAGES: stages.STAGES,
    PAIS_POR_ID: paises.PAIS_POR_ID,
    PASO: constantes.PASO,
    ANCHO: constantes.ANCHO,
    ALTO: constantes.ALTO,
  };
  return cargado;
}

/**
 * Un altavoz que no suena.
 *
 * El sonido lo pone cada jugador en su móvil, a partir de lo que ve. El
 * servidor solo tiene que aceptar los avisos sin quejarse.
 */
export const audioMudo = {
  despertar() {},
  disparo() {},
  impacto() {},
  explosion() {},
  bomba() {},
  powerUp() {},
  aviso() {},
  muerte() {},
  leitmotiv() {},
  ponerMusica() {},
  pararMusica() {},
  actualizarMusica() {},
};
