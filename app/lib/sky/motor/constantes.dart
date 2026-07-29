/// Medidas y ritmos que comparte todo Sky Warriors.
///
/// El juego piensa siempre en un campo de 480x640 y nunca en píxeles de
/// pantalla: el lienzo se escala entero al hueco que haya. Así una partida se
/// ve igual en un móvil pequeño y en un Mac, y los enemigos aparecen siempre en
/// el mismo sitio.
library;

const double anchoCampo = 480;
const double altoCampo = 640;

/// Paso fijo de simulación. El bucle acumula tiempo y da pasos de este tamaño.
const double paso = 1 / 60;

/// Radio de la caja de choque del jugador, mucho menor que el dibujo.
///
/// Es la convención del género desde los noventa: se esquiva con un punto
/// diminuto en el centro del avión. Sin esto, una pantalla llena de balas sería
/// injusta en vez de difícil.
const double radioJugador = 4;

const int nivelMaximo = 4;
const int bombasMaximas = 6;
const double velocidadExtraMaxima = 0.5;
