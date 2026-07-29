/**
 * Medidas y ritmos que comparte todo el juego.
 *
 * La resolución es fija (480x640, vertical de recreativa) y el lienzo se escala
 * entero al hueco que haya. Todo el juego piensa en estos píxeles y nunca en
 * los de la pantalla: así una misma partida se ve igual en un móvil y en un
 * monitor de 4K, y las posiciones de los enemigos son siempre las mismas.
 */
export const ANCHO = 480;
export const ALTO = 640;

/** Paso fijo de simulación. El bucle acumula tiempo y da pasos de este tamaño. */
export const PASO = 1 / 60;

/**
 * Radio de la caja de choque del jugador, mucho menor que el dibujo de la nave.
 *
 * Es la convención de todo el género desde los años noventa: el jugador esquiva
 * con un punto diminuto en el centro del avión. Sin esto, un juego con la
 * pantalla llena de balas sería injusto en vez de difícil.
 */
export const RADIO_JUGADOR = 4;

/** Máximos que impone el documento para los power-ups. */
export const NIVEL_MAX = 4;
export const BOMBAS_MAX = 6;
export const VELOCIDAD_EXTRA_MAX = 0.5;
