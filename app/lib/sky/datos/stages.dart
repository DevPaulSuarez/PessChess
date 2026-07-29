/// Los escenarios: qué sale, cuándo sale y qué hay que hacer para que aparezca
/// el jefe de verdad.
///
/// El guion es una lista de sucesos en orden. Cada uno espera unos segundos
/// desde el anterior, y los que bloquean no dejan seguir hasta que se cumple
/// algo (que no quede nadie en pantalla, normalmente). Con eso se escribe un
/// escenario entero sin una línea de código.
library;

import 'dart:ui' show Color;

class DisparoEnemigo {
  const DisparoEnemigo({
    required this.cada,
    required this.tipo,
    required this.balas,
    required this.velocidad,
    required this.color,
    this.apertura,
  });

  /// Segundos entre ráfagas.
  final double cada;

  /// 'directo', 'espiral', 'abanico' o 'ninguno'.
  final String tipo;
  final int balas;
  final double velocidad;
  final Color color;
  final double? apertura;
}

class Plantilla {
  const Plantilla({
    required this.forma,
    required this.movimiento,
    required this.radio,
    required this.vida,
    required this.puntos,
    required this.colores,
    this.vx = 0,
    this.vy = 90,
    this.amplitud = 70,
    this.frecuencia = 2.2,
    this.velocidadPicada = 260,
    this.alturaParada = 120,
    this.categoria = 'enemigo',
    this.disparo,
    this.esMidBoss = false,
  });

  final String forma;
  final String movimiento;
  final double radio;
  final double vida;
  final int puntos;
  final List<Color> colores;
  final double vx;
  final double vy;
  final double amplitud;
  final double frecuencia;
  final double velocidadPicada;
  final double alturaParada;

  /// 'enemigo' cuenta para el 85%; 'escenario' no.
  final String categoria;
  final DisparoEnemigo? disparo;
  final bool esMidBoss;
}

class Suceso {
  const Suceso({
    required this.espera,
    required this.tipo,
    this.texto,
    this.plantilla,
    this.cuantos = 1,
    this.formacion = 'aleatoria',
    this.zona,
    this.duracion = 0,
  });

  /// Segundos desde el suceso anterior.
  final double espera;

  /// 'anuncio', 'oleada', 'esperarLimpio', 'zonaEspecial' o 'jefe'.
  final String tipo;
  final String? texto;
  final String? plantilla;
  final int cuantos;
  final String formacion;
  final String? zona;
  final double duracion;
}

class ParteJefe {
  const ParteJefe({required this.radio, required this.vida, this.dx = 0, this.dy = 0, this.rastro});

  final double radio;
  final double vida;
  final double dx;
  final double dy;

  /// Si tiene valor, la parte sigue el rastro de la cabeza a esa distancia:
  /// es lo que hace ondular a la serpiente sin programar la onda.
  final int? rastro;
}

class AtaqueJefe {
  const AtaqueJefe({
    required this.cada,
    required this.tipo,
    this.espera,
    this.balas = 6,
    this.velocidad = 180,
    this.apertura,
    this.giro,
    this.color = const Color(0xFFFF7043),
    this.forma = 'esfera',
    this.duracion = 5,
  });

  final double cada;

  /// 'abanico', 'circulo', 'dirigido', 'lluvia', 'veneno' o 'laser'.
  final String tipo;
  final double? espera;
  final int balas;
  final double velocidad;
  final double? apertura;
  final double? giro;
  final Color color;
  final String forma;
  final double duracion;
}

class Invocacion {
  const Invocacion({required this.cada, required this.plantilla, required this.cuantos});

  final double cada;
  final String plantilla;
  final int cuantos;
}

class FaseJefe {
  const FaseJefe({
    required this.nombre,
    required this.vida,
    required this.movimiento,
    this.forma,
    this.ritmo,
    this.velocidadCaza,
    this.requierePartes = false,
    this.deLaColaALaCabeza = false,
    this.partes = const [],
    this.ataques = const [],
    this.invoca,
  });

  final String nombre;

  /// Fracción de la vida total del jefe que ocupa esta fase.
  final double vida;

  /// 'vaiven', 'zigzag', 'persigue', 'ascenso' o 'quieto'.
  final String movimiento;

  /// Si la fase cambia la silueta del jefe.
  final String? forma;
  final double? ritmo;
  final double? velocidadCaza;

  /// Si el núcleo está blindado hasta que caigan las partes.
  final bool requierePartes;

  /// Si solo se puede dañar la última parte viva.
  final bool deLaColaALaCabeza;
  final List<ParteJefe> partes;
  final List<AtaqueJefe> ataques;
  final Invocacion? invoca;
}

class DefJefe {
  const DefJefe({
    required this.nombre,
    required this.forma,
    required this.radio,
    required this.colores,
    required this.fases,
    this.altura = 130,
    this.velocidad = 120,
    this.escalaVida = 1,
  });

  final String nombre;
  final String forma;
  final double radio;
  final List<Color> colores;
  final List<FaseJefe> fases;
  final double altura;
  final double velocidad;
  final double escalaVida;
}

class Insignia {
  const Insignia({required this.tipo, required this.pista, this.segundos = 0, this.objetivo = 0});

  /// 'campanas', 'silencio' o 'icebergs'.
  final String tipo;
  final String pista;
  final double segundos;
  final int objetivo;
}

class Stage {
  const Stage({
    required this.id,
    required this.numero,
    required this.titulo,
    required this.lugar,
    required this.ambiente,
    required this.fondo,
    required this.insignia,
    required this.plantillas,
    required this.guion,
    required this.jefe,
    this.viento = false,
  });

  final String id;
  final int numero;
  final String titulo;
  final String lugar;
  final String ambiente;

  /// 'ciudad', 'selva' o 'glaciar'.
  final String fondo;
  final Insignia insignia;
  final Map<String, Plantilla> plantillas;
  final List<Suceso> guion;
  final DefJefe jefe;

  /// Si el escenario empuja las naves de lado.
  final bool viento;
}

const List<Stage> stages = [
  // =========================================================================
  Stage(
    id: 'mexico',
    numero: 1,
    titulo: 'Despertar Global',
    lugar: 'Ciudad de México',
    ambiente: 'Amanecer sobre el Zócalo. La ciudad arde y el cielo está tomado.',
    fondo: 'ciudad',
    insignia: Insignia(
      tipo: 'campanas',
      pista: 'Las campanas de la catedral, de izquierda a derecha. Sin tocar los edificios.',
    ),
    plantillas: {
      'chupacabra': Plantilla(
        forma: 'dron', movimiento: 'seno', radio: 12, vida: 22, puntos: 150,
        vy: 150, amplitud: 60, colores: [Color(0xFF8D6E63), Color(0xFF4E342E), Color(0xFFFF8A65)],
      ),
      'jaguar': Plantilla(
        forma: 'tanque', movimiento: 'suelo', radio: 18, vida: 90, puntos: 1200,
        vy: 60, colores: [Color(0xFF6D4C41), Color(0xFF3E2723), Color(0xFFFFB300)],
        disparo: DisparoEnemigo(cada: 2.1, tipo: 'directo', balas: 1, velocidad: 200, color: Color(0xFFFFB300)),
      ),
      'quetzalcoatl': Plantilla(
        forma: 'heli', movimiento: 'entrar', radio: 20, vida: 150, puntos: 3000,
        vy: 90, alturaParada: 150, colores: [Color(0xFF00897B), Color(0xFF004D40), Color(0xFFB2FF59)],
        disparo: DisparoEnemigo(cada: 2.6, tipo: 'espiral', balas: 5, velocidad: 165, color: Color(0xFFB2FF59)),
      ),
      'aguila': Plantilla(
        forma: 'ave', movimiento: 'picada', radio: 13, vida: 30, puntos: 500,
        velocidadPicada: 250, colores: [Color(0xFFFFB300), Color(0xFFE65100), Color(0xFFFFF8E1)],
      ),
      'campana': Plantilla(
        forma: 'campana', movimiento: 'suelo', radio: 20, vida: 60, puntos: 800,
        vy: 34, categoria: 'escenario', colores: [Color(0xFFBCAAA4), Color(0xFF6D4C41), Color(0xFFFFD54F)],
      ),
      'edificio': Plantilla(
        forma: 'edificio', movimiento: 'suelo', radio: 26, vida: 220, puntos: 0,
        vy: 34, categoria: 'escenario', colores: [Color(0xFF546E7A), Color(0xFF263238), Color(0xFFFFE082)],
      ),
      'tlaloc': Plantilla(
        forma: 'torreta', movimiento: 'entrar', radio: 34, vida: 1800, puntos: 10000,
        vy: 70, alturaParada: 130, esMidBoss: true,
        colores: [Color(0xFF0288D1), Color(0xFF01579B), Color(0xFFE1F5FE)],
        disparo: DisparoEnemigo(cada: 1.5, tipo: 'abanico', balas: 7, velocidad: 175, color: Color(0xFF81D4FA), apertura: 1.5),
      ),
    },
    guion: [
      Suceso(espera: 1.5, tipo: 'anuncio', texto: 'CIUDAD DE MÉXICO'),
      Suceso(espera: 1.5, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 12, formacion: 'uve'),
      Suceso(espera: 7, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 12, formacion: 'lados'),
      Suceso(espera: 7, tipo: 'oleada', plantilla: 'jaguar', cuantos: 4, formacion: 'suelo'),
      Suceso(espera: 8, tipo: 'oleada', plantilla: 'quetzalcoatl', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 9, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 14, formacion: 'aleatoria'),
      Suceso(espera: 4, tipo: 'anuncio', texto: 'CATEDRAL METROPOLITANA'),
      Suceso(espera: 1, tipo: 'oleada', plantilla: 'edificio', cuantos: 2, formacion: 'lados'),
      Suceso(espera: 1.5, tipo: 'oleada', plantilla: 'campana', cuantos: 4, formacion: 'fila'),
      Suceso(espera: 10, tipo: 'anuncio', texto: '¡CUIDADO!'),
      Suceso(espera: 1, tipo: 'oleada', plantilla: 'tlaloc', cuantos: 1, formacion: 'centro'),
      Suceso(espera: 0, tipo: 'esperarLimpio'),
      Suceso(espera: 2, tipo: 'oleada', plantilla: 'jaguar', cuantos: 5, formacion: 'suelo'),
      Suceso(espera: 8, tipo: 'oleada', plantilla: 'quetzalcoatl', cuantos: 4, formacion: 'fila'),
      Suceso(espera: 9, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 16, formacion: 'aleatoria'),
      Suceso(espera: 8, tipo: 'jefe'),
    ],
    jefe: DefJefe(
      nombre: 'Huitzilopochtli',
      forma: 'colibri',
      radio: 52,
      colores: [Color(0xFF00897B), Color(0xFF004D40), Color(0xFFFFD54F)],
      fases: [
        FaseJefe(
          nombre: 'Colibrí de guerra',
          vida: 0.35,
          movimiento: 'zigzag',
          ataques: [
            AtaqueJefe(cada: 1.5, tipo: 'abanico', balas: 9, velocidad: 190, apertura: 1.6, color: Color(0xFFFFE082), forma: 'pluma'),
            AtaqueJefe(cada: 3.2, tipo: 'dirigido', balas: 3, velocidad: 250, color: Color(0xFFFFF59D)),
          ],
        ),
        FaseJefe(
          nombre: 'Esfera solar',
          vida: 0.35,
          forma: 'esfera',
          movimiento: 'vaiven',
          ataques: [
            AtaqueJefe(cada: 1.8, tipo: 'circulo', balas: 8, velocidad: 165, giro: 0.4, color: Color(0xFFFFB300)),
          ],
          invoca: Invocacion(cada: 6, plantilla: 'aguila', cuantos: 2),
        ),
        FaseJefe(
          nombre: 'Ira divina',
          vida: 0.3,
          forma: 'esfera',
          movimiento: 'persigue',
          velocidadCaza: 130,
          ataques: [
            AtaqueJefe(cada: 1.1, tipo: 'circulo', balas: 10, velocidad: 195, giro: 0.9, color: Color(0xFFFF5252)),
            AtaqueJefe(cada: 2.4, tipo: 'dirigido', balas: 5, velocidad: 275, color: Color(0xFFFF8A80)),
            AtaqueJefe(cada: 3.6, tipo: 'lluvia', balas: 6, velocidad: 210, color: Color(0xFFFFAB91)),
          ],
        ),
      ],
    ),
  ),

  // =========================================================================
  Stage(
    id: 'amazonas',
    numero: 2,
    titulo: 'Selva Sagrada',
    lugar: 'Amazonas',
    ambiente: 'Niebla verde sobre el río. Algo se mueve bajo las copas.',
    fondo: 'selva',
    insignia: Insignia(
      tipo: 'silencio',
      pista: 'Sobre el río, quien no dispara ve cosas que los demás no ven.',
      segundos: 30,
    ),
    plantillas: {
      'anopheles': Plantilla(
        forma: 'mosquito', movimiento: 'zigzag', radio: 9, vida: 12, puntos: 150,
        vy: 175, amplitud: 190, colores: [Color(0xFF7CB342), Color(0xFF33691E), Color(0xFFC5E1A5)],
      ),
      'boto': Plantilla(
        forma: 'barco', movimiento: 'suelo', radio: 20, vida: 120, puntos: 1200,
        vy: 55, colores: [Color(0xFF455A64), Color(0xFF263238), Color(0xFF4DD0E1)],
        disparo: DisparoEnemigo(cada: 2.4, tipo: 'directo', balas: 2, velocidad: 195, color: Color(0xFF4DD0E1)),
      ),
      'iara': Plantilla(
        // Sube desde abajo y se planta: un árbol no persigue a nadie, pero
        // tampoco se marcha, así que hay que derribarlo.
        forma: 'arbol', movimiento: 'entrar', radio: 24, vida: 260, puntos: 3000,
        vy: 80, alturaParada: 170, colores: [Color(0xFF2E7D32), Color(0xFF1B5E20), Color(0xFFAED581)],
        disparo: DisparoEnemigo(cada: 2.8, tipo: 'abanico', balas: 6, velocidad: 150, color: Color(0xFFAED581)),
      ),
      'delfin': Plantilla(
        forma: 'submarino', movimiento: 'lateral', radio: 16, vida: 40, puntos: 500,
        vx: 90, categoria: 'escenario', colores: [Color(0xFFF48FB1), Color(0xFFAD1457), Color(0xFFFCE4EC)],
      ),
      'curupira': Plantilla(
        forma: 'ave', movimiento: 'entrar', radio: 30, vida: 2000, puntos: 10000,
        vy: 80, alturaParada: 140, esMidBoss: true,
        colores: [Color(0xFFEF6C00), Color(0xFFBF360C), Color(0xFFFFE082)],
        disparo: DisparoEnemigo(cada: 1.3, tipo: 'espiral', balas: 6, velocidad: 185, color: Color(0xFFFFAB40)),
      ),
    },
    guion: [
      Suceso(espera: 1.5, tipo: 'anuncio', texto: 'AMAZONAS'),
      Suceso(espera: 1.5, tipo: 'oleada', plantilla: 'anopheles', cuantos: 20, formacion: 'aleatoria'),
      Suceso(espera: 7, tipo: 'oleada', plantilla: 'anopheles', cuantos: 18, formacion: 'lados'),
      Suceso(espera: 7, tipo: 'oleada', plantilla: 'iara', cuantos: 2, formacion: 'lados'),
      Suceso(espera: 9, tipo: 'anuncio', texto: 'EL RÍO'),
      Suceso(espera: 0, tipo: 'zonaEspecial', zona: 'rio', duracion: 42),
      Suceso(espera: 1, tipo: 'oleada', plantilla: 'boto', cuantos: 4, formacion: 'suelo'),
      Suceso(espera: 10, tipo: 'oleada', plantilla: 'boto', cuantos: 4, formacion: 'suelo'),
      Suceso(espera: 12, tipo: 'oleada', plantilla: 'anopheles', cuantos: 16, formacion: 'uve'),
      Suceso(espera: 10, tipo: 'anuncio', texto: '¡ALGO SE ACERCA!'),
      Suceso(espera: 1, tipo: 'oleada', plantilla: 'curupira', cuantos: 1, formacion: 'centro'),
      Suceso(espera: 0, tipo: 'esperarLimpio'),
      Suceso(espera: 2, tipo: 'oleada', plantilla: 'iara', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 9, tipo: 'oleada', plantilla: 'anopheles', cuantos: 22, formacion: 'aleatoria'),
      Suceso(espera: 8, tipo: 'jefe'),
    ],
    jefe: DefJefe(
      nombre: 'Anaconda Mecánica',
      forma: 'serpiente',
      radio: 34,
      altura: 120,
      velocidad: 150,
      colores: [Color(0xFF43A047), Color(0xFF1B5E20), Color(0xFFFFD54F)],
      fases: [
        FaseJefe(
          nombre: 'Cinco anillos',
          vida: 0.3,
          movimiento: 'zigzag',
          requierePartes: true,
          deLaColaALaCabeza: true,
          partes: [
            ParteJefe(radio: 22, vida: 700, rastro: 40),
            ParteJefe(radio: 22, vida: 700, rastro: 80),
            ParteJefe(radio: 22, vida: 700, rastro: 120),
            ParteJefe(radio: 22, vida: 700, rastro: 160),
            ParteJefe(radio: 22, vida: 700, rastro: 200),
          ],
          ataques: [
            AtaqueJefe(cada: 2.2, tipo: 'dirigido', balas: 3, velocidad: 200, color: Color(0xFFAED581)),
          ],
        ),
        FaseJefe(
          nombre: 'Cabeza suelta',
          vida: 0.4,
          movimiento: 'persigue',
          velocidadCaza: 110,
          ataques: [
            AtaqueJefe(cada: 2.6, tipo: 'veneno', balas: 4, color: Color(0x99A5D6A7)),
            AtaqueJefe(cada: 1.6, tipo: 'abanico', balas: 7, velocidad: 185, apertura: 1.4, color: Color(0xFF9CCC65)),
          ],
        ),
        FaseJefe(
          nombre: 'Tres cabezas',
          vida: 0.3,
          movimiento: 'vaiven',
          requierePartes: true,
          partes: [
            ParteJefe(radio: 20, vida: 900, dx: -70, dy: 20),
            ParteJefe(radio: 20, vida: 900, dx: 0, dy: -20),
            ParteJefe(radio: 20, vida: 900, dx: 70, dy: 20),
          ],
          ataques: [
            AtaqueJefe(cada: 1.4, tipo: 'circulo', balas: 9, velocidad: 180, giro: 0.6, color: Color(0xFF7CB342)),
            AtaqueJefe(cada: 3, tipo: 'lluvia', balas: 5, velocidad: 200, color: Color(0xFFC5E1A5)),
          ],
        ),
      ],
    ),
  ),

  // =========================================================================
  Stage(
    id: 'patagonia',
    numero: 3,
    titulo: 'Corazón de Hielo',
    lugar: 'Patagonia',
    ambiente: 'Ventisca sobre el glaciar. El viento empuja. Algo late bajo el hielo.',
    fondo: 'glaciar',
    viento: true,
    insignia: Insignia(tipo: 'icebergs', pista: 'Siete icebergs. Ni seis, ni ocho.', objetivo: 7),
    plantillas: {
      'pinguino': Plantilla(
        forma: 'pinguino', movimiento: 'seno', radio: 12, vida: 26, puntos: 150,
        vy: 165, amplitud: 90, colores: [Color(0xFF37474F), Color(0xFFECEFF1), Color(0xFFFFB300)],
      ),
      'leopard': Plantilla(
        forma: 'submarino', movimiento: 'entrar', radio: 20, vida: 160, puntos: 1200,
        vy: 95, alturaParada: 200, colores: [Color(0xFF455A64), Color(0xFF1C313A), Color(0xFF4FC3F7)],
        disparo: DisparoEnemigo(cada: 2.2, tipo: 'directo', balas: 2, velocidad: 215, color: Color(0xFF4FC3F7)),
      ),
      'iceberg': Plantilla(
        forma: 'iceberg', movimiento: 'suelo', radio: 24, vida: 70, puntos: 400,
        vy: 70, categoria: 'escenario', colores: [Color(0xFFB3E5FC), Color(0xFF4FC3F7), Color(0xFFE1F5FE)],
      ),
      'esquirla': Plantilla(
        forma: 'dron', movimiento: 'recto', radio: 8, vida: 14, puntos: 100,
        vy: 240, colores: [Color(0xFFE1F5FE), Color(0xFF81D4FA), Color(0xFFFFFFFF)],
      ),
      'yeti': Plantilla(
        forma: 'torreta', movimiento: 'entrar', radio: 36, vida: 2400, puntos: 10000,
        vy: 60, alturaParada: 125, esMidBoss: true,
        colores: [Color(0xFFECEFF1), Color(0xFF90A4AE), Color(0xFF4FC3F7)],
        disparo: DisparoEnemigo(cada: 1.7, tipo: 'abanico', balas: 8, velocidad: 170, color: Color(0xFFE1F5FE), apertura: 1.7),
      ),
    },
    guion: [
      Suceso(espera: 1.5, tipo: 'anuncio', texto: 'PATAGONIA'),
      Suceso(espera: 1.5, tipo: 'oleada', plantilla: 'pinguino', cuantos: 12, formacion: 'uve'),
      Suceso(espera: 7, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 6, tipo: 'oleada', plantilla: 'leopard', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 9, tipo: 'oleada', plantilla: 'pinguino', cuantos: 14, formacion: 'lados'),
      Suceso(espera: 7, tipo: 'anuncio', texto: 'TORMENTA DE HIELO'),
      Suceso(espera: 0.5, tipo: 'oleada', plantilla: 'esquirla', cuantos: 20, formacion: 'aleatoria'),
      Suceso(espera: 5, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 6, tipo: 'oleada', plantilla: 'esquirla', cuantos: 18, formacion: 'aleatoria'),
      Suceso(espera: 6, tipo: 'anuncio', texto: '¡ALGO CAMINA SOBRE EL GLACIAR!'),
      Suceso(espera: 1, tipo: 'oleada', plantilla: 'yeti', cuantos: 1, formacion: 'centro'),
      Suceso(espera: 0, tipo: 'esperarLimpio'),
      Suceso(espera: 2, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila'),
      Suceso(espera: 6, tipo: 'oleada', plantilla: 'leopard', cuantos: 4, formacion: 'fila'),
      Suceso(espera: 9, tipo: 'oleada', plantilla: 'pinguino', cuantos: 16, formacion: 'aleatoria'),
      Suceso(espera: 8, tipo: 'jefe'),
    ],
    jefe: DefJefe(
      nombre: 'Torre de Babel Helada',
      forma: 'torre',
      radio: 56,
      altura: 140,
      colores: [Color(0xFFCFD8DC), Color(0xFF607D8B), Color(0xFF4FC3F7)],
      fases: [
        FaseJefe(
          nombre: 'Cuatro torretas',
          vida: 0.3,
          movimiento: 'vaiven',
          ritmo: 0.6,
          requierePartes: true,
          partes: [
            ParteJefe(radio: 16, vida: 600, dx: -60, dy: -30),
            ParteJefe(radio: 16, vida: 600, dx: 60, dy: -30),
            ParteJefe(radio: 16, vida: 600, dx: -60, dy: 30),
            ParteJefe(radio: 16, vida: 600, dx: 60, dy: 30),
          ],
          ataques: [
            AtaqueJefe(cada: 1.9, tipo: 'abanico', balas: 8, velocidad: 175, apertura: 1.5, color: Color(0xFF81D4FA)),
          ],
        ),
        FaseJefe(
          nombre: 'Despegue',
          vida: 0.35,
          movimiento: 'ascenso',
          ataques: [
            AtaqueJefe(cada: 1.2, tipo: 'lluvia', balas: 7, velocidad: 260, color: Color(0xFFB0BEC5)),
            AtaqueJefe(cada: 2.6, tipo: 'dirigido', balas: 3, velocidad: 230, color: Color(0xFF4FC3F7)),
          ],
        ),
        FaseJefe(
          nombre: 'Cañón orbital',
          vida: 0.35,
          movimiento: 'quieto',
          ataques: [
            AtaqueJefe(cada: 7, espera: 2, tipo: 'laser', duracion: 5.5, giro: 0.55, color: Color(0xFFFF5252)),
            AtaqueJefe(cada: 2.1, tipo: 'circulo', balas: 8, velocidad: 170, giro: 0.5, color: Color(0xFF90CAF9)),
          ],
        ),
      ],
    ),
  ),
];

/// El jefe que sale cuando el equipo no cumplió las condiciones.
///
/// Es el mismo para los tres escenarios y es ridículo a propósito: un mono en
/// una nave tirando plátanos. Verlo aparecer tiene que doler más que su
/// dificultad, que es ninguna.
const DefJefe jefeSustituto = DefJefe(
  nombre: 'Osaru',
  forma: 'mono',
  radio: 44,
  altura: 120,
  escalaVida: 0.5,
  colores: [Color(0xFF8D6E63), Color(0xFF5D4037), Color(0xFFFFD54F)],
  fases: [
    FaseJefe(
      nombre: 'El mono espacial',
      vida: 1,
      movimiento: 'vaiven',
      ritmo: 0.7,
      ataques: [
        AtaqueJefe(cada: 2.4, tipo: 'abanico', balas: 4, velocidad: 130, apertura: 1.2, color: Color(0xFFFFE082)),
      ],
    ),
  ],
);
