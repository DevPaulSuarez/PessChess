/// Los países jugables, con sus dos pilotos, su arma y su bomba.
///
/// Esto es una tabla de datos, no de comportamiento: el arma dice *qué tipo* de
/// disparo usa (`motor/armas.dart` sabe hacerlos) y con qué números. Añadir un
/// país es añadir una entrada aquí, sin tocar el juego.
///
/// Los pilotos son personajes de ficción. Donde el documento de diseño nombraba
/// a una persona real se cambió el nombre: un juego en el que se dispara no es
/// sitio para poner a nadie que exista.
library;

import 'dart:ui' show Color;

/// Cómo se pinta una bandera. No busca exactitud heráldica —a cuarenta píxeles
/// no cabe un escudo— sino que el país se reconozca de un vistazo.
class Bandera {
  const Bandera(this.tipo, {this.franjas = const [], this.pesos, this.emblema});

  /// 'h', 'v', 'usa', 'china', 'cuba', 'cruz', 'chile' o 'panama'.
  final String tipo;
  final List<Color> franjas;
  final List<int>? pesos;
  final Color? emblema;
}

class Arma {
  const Arma({
    required this.tipo,
    required this.nombre,
    required this.color,
    required this.cadencia,
    required this.dano,
    this.alcance,
    this.apertura,
    this.giro,
    this.dispersion,
    this.amplitud,
    this.esquirlas,
    this.efecto,
  });

  /// Uno de los diez tipos que sabe hacer `armas.dart`.
  final String tipo;
  final String nombre;
  final Color color;

  /// Segundos entre disparos.
  final double cadencia;
  final double dano;

  /// Distancia a la que se apaga el proyectil, si se apaga.
  final double? alcance;
  final double? apertura;
  final double? giro;
  final double? dispersion;
  final double? amplitud;
  final int? esquirlas;

  /// 'lento', 'arrastre' o 'empuje': lo que le hace al enemigo además de daño.
  final String? efecto;
}

class Bomba {
  const Bomba({required this.tipo, required this.nombre, required this.color});

  /// 'pantalla', 'barrido', 'escudo', 'columna' o 'lluvia'.
  final String tipo;
  final String nombre;
  final Color color;
}

class Nave {
  const Nave({
    required this.nombre,
    required this.piloto,
    required this.silueta,
    required this.velocidad,
    required this.poder,
    required this.bombas,
  });

  final String nombre;
  final String piloto;

  /// Cuál de las ocho siluetas dibuja `ui/naves.dart`.
  final String silueta;

  /// De 1 a 5, lo que se enseña en el selector.
  final int velocidad;
  final int poder;
  final int bombas;
}

class Pais {
  const Pais({
    required this.id,
    required this.nombre,
    required this.region,
    required this.colores,
    required this.bandera,
    required this.frase,
    required this.arma,
    required this.bomba,
    required this.naves,
  });

  final String id;
  final String nombre;
  final String region;

  /// Principal, secundario y acento: con eso se pinta la nave entera.
  final List<Color> colores;
  final Bandera bandera;
  final String frase;
  final Arma arma;
  final Bomba bomba;
  final List<Nave> naves;
}

// Cadencias de referencia, en segundos entre disparos.
const double _rapido = 0.1;
const double _medio = 0.14;
const double _lento = 0.22;

const _blanco = Color(0xFFFFFFFF);

const List<Pais> paises = [
  // ---------------------------------------------------------- Norteamérica ---
  Pais(
    id: 'usa',
    nombre: 'Estados Unidos',
    region: 'América del Norte',
    colores: [Color(0xFF3C3B6E), _blanco, Color(0xFFB22234)],
    bandera: Bandera('usa'),
    frase: '¡En el aire no hay fronteras!',
    arma: Arma(
      tipo: 'guiado',
      nombre: 'Misiles guiados por láser',
      color: Color(0xFFFFE082),
      cadencia: _medio,
      dano: 11,
    ),
    bomba: Bomba(tipo: 'barrido', nombre: 'Ataque aéreo B-2', color: Color(0xFF90CAF9)),
    naves: [
      Nave(nombre: 'F-35 Lightning II', piloto: 'Cap. Jackson «Thunder» Reed', silueta: 'caza', velocidad: 4, poder: 4, bombas: 3),
      Nave(nombre: 'F-22 Raptor', piloto: 'Cte. Sarah «Viper» Chen', silueta: 'raptor', velocidad: 5, poder: 3, bombas: 2),
    ],
  ),
  Pais(
    id: 'mexico',
    nombre: 'México',
    region: 'América del Norte',
    colores: [Color(0xFF006847), _blanco, Color(0xFFCE1126)],
    bandera: Bandera('v', franjas: [Color(0xFF006847), _blanco, Color(0xFFCE1126)], emblema: Color(0xFF8D6E3C)),
    frase: '¡Vamos con todo!',
    arma: Arma(
      tipo: 'plasma',
      nombre: 'Cañón de plasma azul',
      color: Color(0xFF4FC3F7),
      cadencia: _lento,
      dano: 26,
      alcance: 260, // corto: el plasma se apaga a media pantalla
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Fuerza del Sol', color: Color(0xFFFFD54F)),
    naves: [
      Nave(nombre: 'F-5E Tiger II', piloto: 'Tte. Diego «Águila» Morales', silueta: 'caza', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'T-6C Texan II', piloto: 'Cap. Frida «Jaguar» López', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
    ],
  ),

  // ---------------------------------------------------------- Centroamérica ---
  Pais(
    id: 'guatemala',
    nombre: 'Guatemala',
    region: 'América Central',
    colores: [Color(0xFF4997D0), _blanco, Color(0xFF4997D0)],
    bandera: Bandera('v', franjas: [Color(0xFF4997D0), _blanco, Color(0xFF4997D0)], emblema: Color(0xFF4D7C3A)),
    frase: '¡Por el quetzal!',
    arma: Arma(
      tipo: 'abanico',
      nombre: 'Cañones rotativos laterales',
      color: Color(0xFFAED581),
      cadencia: _medio,
      dano: 9,
      apertura: 0.5,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Erupción', color: Color(0xFFFF8A65)),
    naves: [
      Nave(nombre: 'A-37B Dragonfly', piloto: 'Sgto. Carlos «Quetzal» Estrada', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'AC-47 Spooky', piloto: 'Tte. Ana «Volcán» Castellanos', silueta: 'bimotor', velocidad: 2, poder: 5, bombas: 4),
    ],
  ),
  Pais(
    id: 'salvador',
    nombre: 'El Salvador',
    region: 'América Central',
    colores: [Color(0xFF0F47AF), _blanco, Color(0xFF0F47AF)],
    bandera: Bandera('h', franjas: [Color(0xFF0F47AF), _blanco, Color(0xFF0F47AF)], emblema: Color(0xFFD4A017)),
    frase: '¡Con fuego en el alma!',
    arma: Arma(
      tipo: 'enjambre',
      nombre: 'Ráfaga de cohetes',
      color: Color(0xFFFF7043),
      cadencia: _rapido,
      dano: 6,
      dispersion: 0.22,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Tormenta Tropical', color: Color(0xFF4DD0E1)),
    naves: [
      Nave(nombre: 'Cessna A-37B', piloto: 'Cap. Roberto «Cacao» Martínez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'IA-58 Pucará', piloto: 'Tte. Lucía «Flama» Rivas', silueta: 'bimotor', velocidad: 3, poder: 4, bombas: 3),
    ],
  ),
  Pais(
    id: 'honduras',
    nombre: 'Honduras',
    region: 'América Central',
    colores: [Color(0xFF0073CF), _blanco, Color(0xFF0073CF)],
    bandera: Bandera('h', franjas: [Color(0xFF0073CF), _blanco, Color(0xFF0073CF)], emblema: Color(0xFF0073CF)),
    frase: '¡Adelante, catrachos!',
    arma: Arma(
      tipo: 'penetrante',
      nombre: 'Cañón de iones',
      color: Color(0xFFB39DDB),
      cadencia: _lento,
      dano: 18,
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Marea', color: Color(0xFF4FC3F7)),
    naves: [
      Nave(nombre: 'F-86 Sabre', piloto: 'May. Pedro «Garza» Aguilar', silueta: 'caza', velocidad: 3, poder: 4, bombas: 3),
      Nave(nombre: 'Super Tucano', piloto: 'Cap. María «Coral» Fernández', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
    ],
  ),
  Pais(
    id: 'nicaragua',
    nombre: 'Nicaragua',
    region: 'América Central',
    colores: [Color(0xFF0067C6), _blanco, Color(0xFF0067C6)],
    bandera: Bandera('h', franjas: [Color(0xFF0067C6), _blanco, Color(0xFF0067C6)], emblema: Color(0xFFF5C542)),
    frase: '¡Que arda el cielo!',
    arma: Arma(
      tipo: 'plasma',
      nombre: 'Lanzallamas aéreo',
      color: Color(0xFFFFAB40),
      cadencia: 0.06,
      dano: 7,
      alcance: 150, // el fuego no llega lejos, pero lo que toca lo funde
    ),
    bomba: Bomba(tipo: 'columna', nombre: 'Momotombo', color: Color(0xFFFF7043)),
    naves: [
      Nave(nombre: 'L-39 Albatros', piloto: 'Cte. José «Volcán» Ortega', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'MiG-21', piloto: 'Tte. Elena «Lago» Ruiz', silueta: 'interceptor', velocidad: 5, poder: 3, bombas: 2),
    ],
  ),
  Pais(
    id: 'costarica',
    nombre: 'Costa Rica',
    region: 'América Central',
    colores: [Color(0xFF002B7F), _blanco, Color(0xFFCE1126)],
    bandera: Bandera('h',
        franjas: [Color(0xFF002B7F), _blanco, Color(0xFFCE1126), _blanco, Color(0xFF002B7F)],
        pesos: [1, 1, 2, 1, 1]),
    frase: '¡Pura vida!',
    arma: Arma(
      tipo: 'abanico',
      nombre: 'Disparo ecológico en V',
      color: Color(0xFF81C784),
      cadencia: _medio,
      dano: 10,
      apertura: 0.32,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Biodiversidad', color: Color(0xFFA5D6A7)),
    naves: [
      Nave(nombre: 'OV-10 Bronco', piloto: 'Cap. Andrés «Tucán» Soto', silueta: 'bimotor', velocidad: 3, poder: 4, bombas: 4),
      Nave(nombre: 'T-35 Pillán', piloto: 'Tte. Sofía «Mariposa» Mora', silueta: 'helice', velocidad: 4, poder: 3, bombas: 3),
    ],
  ),
  Pais(
    id: 'panama',
    nombre: 'Panamá',
    region: 'América Central',
    colores: [Color(0xFF005293), _blanco, Color(0xFFDA121A)],
    bandera: Bandera('panama'),
    frase: '¡Puente del mundo!',
    arma: Arma(
      tipo: 'fragmenta',
      nombre: 'Torpedos aéreos',
      color: Color(0xFF4DB6AC),
      cadencia: 0.3,
      dano: 22,
      esquirlas: 6,
    ),
    bomba: Bomba(tipo: 'escudo', nombre: 'Esclusa', color: Color(0xFF4FC3F7)),
    naves: [
      Nave(nombre: 'T-34 Mentor', piloto: 'May. Luis «Canal» Vega', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
      Nave(nombre: 'A-29 Super Tucano', piloto: 'Cap. Diana «Istmo» Herrera', silueta: 'helice', velocidad: 4, poder: 4, bombas: 3),
    ],
  ),

  // --------------------------------------------------------- América del Sur ---
  Pais(
    id: 'colombia',
    nombre: 'Colombia',
    region: 'América del Sur',
    colores: [Color(0xFFFCD116), Color(0xFF003893), Color(0xFFCE1126)],
    bandera: Bandera('h',
        franjas: [Color(0xFFFCD116), Color(0xFF003893), Color(0xFFCE1126)], pesos: [2, 1, 1]),
    frase: '¡Arriba el tricolor!',
    arma: Arma(
      tipo: 'fragmenta',
      nombre: 'Cañón de fragmentación',
      color: Color(0xFFFFD54F),
      cadencia: 0.26,
      dano: 18,
      esquirlas: 8,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Café', color: Color(0xFF8D6E63)),
    naves: [
      Nave(nombre: 'Kfir C-10', piloto: 'Cap. Juan «Andino» García', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2),
      Nave(nombre: 'A-29B Super Tucano', piloto: 'Tte. Valentina «Orquídea» Ruiz', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
    ],
  ),
  Pais(
    id: 'venezuela',
    nombre: 'Venezuela',
    region: 'América del Sur',
    colores: [Color(0xFFFFCC00), Color(0xFF00247D), Color(0xFFCF142B)],
    bandera: Bandera('h',
        franjas: [Color(0xFFFFCC00), Color(0xFF00247D), Color(0xFFCF142B)], emblema: _blanco),
    frase: '¡Desde el llano!',
    arma: Arma(
      tipo: 'guiado',
      nombre: 'Misiles de crucero',
      color: Color(0xFFFF8A80),
      cadencia: 0.2,
      dano: 13,
      giro: 2.4, // persiguen con calma: largo alcance, poca maniobra
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Catatumbo', color: Color(0xFFE1F5FE)),
    naves: [
      Nave(nombre: 'Su-30MK2', piloto: 'May. Hugo «Llanero» Pérez', silueta: 'interceptor', velocidad: 4, poder: 5, bombas: 2),
      Nave(nombre: 'F-16A Fighting Falcon', piloto: 'Cap. Isabel «Ángel» Rodríguez', silueta: 'caza', velocidad: 5, poder: 3, bombas: 3),
    ],
  ),
  Pais(
    id: 'ecuador',
    nombre: 'Ecuador',
    region: 'América del Sur',
    colores: [Color(0xFFFFDD00), Color(0xFF0072CE), Color(0xFFEF3340)],
    bandera: Bandera('h',
        franjas: [Color(0xFFFFDD00), Color(0xFF0072CE), Color(0xFFEF3340)],
        pesos: [2, 1, 1],
        emblema: Color(0xFF7C5C2B)),
    frase: '¡Mitad del mundo!',
    arma: Arma(
      tipo: 'rayo',
      nombre: 'Rayo de energía concentrado',
      color: Color(0xFF80DEEA),
      cadencia: 0.04,
      dano: 3,
    ),
    bomba: Bomba(tipo: 'columna', nombre: 'Ecuador', color: Color(0xFF80DEEA)),
    naves: [
      Nave(nombre: 'Mirage F1JE', piloto: 'Tte. Pablo «Galápagos» Torres', silueta: 'canard', velocidad: 4, poder: 4, bombas: 3),
      Nave(nombre: 'Cheetah C', piloto: 'Cap. Elena «Cotopaxi» Flores', silueta: 'canard', velocidad: 5, poder: 3, bombas: 3),
    ],
  ),
  Pais(
    id: 'peru',
    nombre: 'Perú',
    region: 'América del Sur',
    colores: [Color(0xFFD91023), _blanco, Color(0xFFD91023)],
    bandera: Bandera('v',
        franjas: [Color(0xFFD91023), _blanco, Color(0xFFD91023)], emblema: Color(0xFFC8A951)),
    frase: '¡Fuerza del Inca!',
    arma: Arma(
      tipo: 'rebote',
      nombre: 'Discos ancestrales',
      color: Color(0xFFFFD54F),
      cadencia: 0.2,
      dano: 12,
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Machu Picchu', color: Color(0xFFA1887F)),
    naves: [
      Nave(nombre: 'MiG-29SMT', piloto: 'Cte. Miguel «Inca» Huamán', silueta: 'interceptor', velocidad: 5, poder: 4, bombas: 2),
      Nave(nombre: 'Su-25K', piloto: 'Tte. Rosa «Nazca» Quispe', silueta: 'ataque', velocidad: 3, poder: 5, bombas: 4),
    ],
  ),
  Pais(
    id: 'bolivia',
    nombre: 'Bolivia',
    region: 'América del Sur',
    colores: [Color(0xFFD52B1E), Color(0xFFF9E300), Color(0xFF007A33)],
    bandera: Bandera('h', franjas: [Color(0xFFD52B1E), Color(0xFFF9E300), Color(0xFF007A33)]),
    frase: '¡Desde el altiplano!',
    arma: Arma(
      tipo: 'recto',
      nombre: 'Cañón de sal',
      color: Color(0xFFE0F7FA),
      cadencia: _medio,
      dano: 10,
      efecto: 'lento', // los cristales congelan el avance del enemigo
    ),
    bomba: Bomba(tipo: 'escudo', nombre: 'Salar de Uyuni', color: Color(0xFFE0F7FA)),
    naves: [
      Nave(nombre: 'AT-33 Shooting Star', piloto: 'Cap. Ernesto «Altiplano» Mamani', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'T-34 Mentor', piloto: 'Tte. Carmen «Salar» Choque', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
    ],
  ),
  Pais(
    id: 'paraguay',
    nombre: 'Paraguay',
    region: 'América del Sur',
    colores: [Color(0xFFD52B1E), _blanco, Color(0xFF0038A8)],
    bandera: Bandera('h',
        franjas: [Color(0xFFD52B1E), _blanco, Color(0xFF0038A8)], emblema: Color(0xFFF5C542)),
    frase: '¡Ñande rekove!',
    arma: Arma(
      tipo: 'penetrante',
      nombre: 'Arpones aéreos',
      color: Color(0xFFFFCC80),
      cadencia: 0.24,
      dano: 15,
      efecto: 'arrastre', // engancha al enemigo y tira de él hacia abajo
    ),
    bomba: Bomba(tipo: 'columna', nombre: 'Itaipú', color: Color(0xFFFFF59D)),
    naves: [
      Nave(nombre: 'EMB-312 Tucano', piloto: 'May. Antonio «Guaraní» González', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
      Nave(nombre: 'AT-6 Texan II', piloto: 'Cap. Laura «Yguazú» Benítez', silueta: 'helice', velocidad: 4, poder: 3, bombas: 3),
    ],
  ),
  Pais(
    id: 'uruguay',
    nombre: 'Uruguay',
    region: 'América del Sur',
    colores: [Color(0xFF0038A8), _blanco, Color(0xFFFCD116)],
    bandera: Bandera('h',
        franjas: [_blanco, Color(0xFF0038A8), _blanco, Color(0xFF0038A8), _blanco],
        emblema: Color(0xFFFCD116)),
    frase: '¡Vamo arriba!',
    arma: Arma(
      tipo: 'onda',
      nombre: 'Cañón de ondas',
      color: Color(0xFF81D4FA),
      cadencia: _medio,
      dano: 11,
      efecto: 'empuje',
    ),
    bomba: Bomba(tipo: 'barrido', nombre: 'Gaucho', color: Color(0xFFFFE082)),
    naves: [
      Nave(nombre: 'A-37B Dragonfly', piloto: 'Cap. Martín «Plata» Rodríguez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
      Nave(nombre: 'T-6C Texan II', piloto: 'Tte. Carolina «Punta» Silva', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
    ],
  ),
  Pais(
    id: 'argentina',
    nombre: 'Argentina',
    region: 'América del Sur',
    colores: [Color(0xFF74ACDF), _blanco, Color(0xFFF6B40E)],
    bandera: Bandera('h',
        franjas: [Color(0xFF74ACDF), _blanco, Color(0xFF74ACDF)], emblema: Color(0xFFF6B40E)),
    frase: '¡Vamos todavía!',
    arma: Arma(
      tipo: 'guiado',
      nombre: 'Misiles Exocet',
      color: Color(0xFFFFF59D),
      cadencia: 0.18,
      dano: 15,
      giro: 4.2,
    ),
    bomba: Bomba(tipo: 'barrido', nombre: 'Gloria', color: Color(0xFF74ACDF)),
    naves: [
      Nave(nombre: 'IA-63 Pampa III', piloto: 'Cte. Javier «Pampero» Fernández', silueta: 'ligero', velocidad: 4, poder: 4, bombas: 3),
      Nave(nombre: 'A-4AR Fightinghawk', piloto: 'Cap. Natalia «Tango» Rossi', silueta: 'ataque', velocidad: 4, poder: 4, bombas: 3),
    ],
  ),
  Pais(
    id: 'chile',
    nombre: 'Chile',
    region: 'América del Sur',
    colores: [Color(0xFF0039A6), _blanco, Color(0xFFD52B1E)],
    bandera: Bandera('chile'),
    frase: '¡Viento en popa!',
    arma: Arma(
      tipo: 'recto',
      nombre: 'Cañón de viento',
      color: Color(0xFFB3E5FC),
      cadencia: _rapido,
      dano: 8,
      efecto: 'empuje',
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Calbuco', color: Color(0xFF9E9E9E)),
    naves: [
      Nave(nombre: 'F-16C Fighting Falcon', piloto: 'May. Sebastián «Andes» González', silueta: 'caza', velocidad: 5, poder: 4, bombas: 2),
      Nave(nombre: 'F-5E Tiger III', piloto: 'Tte. Fernanda «Atacama» Muñoz', silueta: 'caza', velocidad: 4, poder: 3, bombas: 3),
    ],
  ),

  // ------------------------------------------------------------------ Caribe ---
  Pais(
    id: 'cuba',
    nombre: 'Cuba',
    region: 'Caribe',
    colores: [Color(0xFF002A8F), _blanco, Color(0xFFCF142B)],
    bandera: Bandera('cuba'),
    frase: '¡Dale, que se puede!',
    arma: Arma(
      tipo: 'enjambre',
      nombre: 'Cohetes rápidos',
      color: Color(0xFFFF8A65),
      cadencia: 0.08,
      dano: 5,
      dispersion: 0.3,
    ),
    bomba: Bomba(tipo: 'pantalla', nombre: 'Estrella Solitaria', color: Color(0xFFEF5350)),
    naves: [
      Nave(nombre: 'MiG-23BN', piloto: 'Cte. Raúl «Habana» Ferrer', silueta: 'interceptor', velocidad: 4, poder: 4, bombas: 3),
      Nave(nombre: 'L-39 Albatros', piloto: 'Tte. Yolanda «Malecón» Martínez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3),
    ],
  ),
  Pais(
    id: 'dominicana',
    nombre: 'República Dominicana',
    region: 'Caribe',
    colores: [Color(0xFF002D62), _blanco, Color(0xFFCE1126)],
    bandera: Bandera('cruz'),
    frase: '¡Que suene el merengue!',
    arma: Arma(
      tipo: 'onda',
      nombre: 'Ritmo caribeño',
      color: Color(0xFFF48FB1),
      cadencia: 0.11,
      dano: 9,
      amplitud: 60,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Carnaval', color: Color(0xFFF06292)),
    naves: [
      Nave(nombre: 'T-35B Pillán', piloto: 'Cap. Pedro «Merengue» De León', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4),
      Nave(nombre: 'A-29 Super Tucano', piloto: 'Tte. Ana «Bachata» Reyes', silueta: 'helice', velocidad: 4, poder: 4, bombas: 3),
    ],
  ),

  // -------------------------------------------------------------------- Asia ---
  Pais(
    id: 'china',
    nombre: 'China',
    region: 'Asia',
    colores: [Color(0xFFDE2910), Color(0xFFFFDE00), Color(0xFFDE2910)],
    bandera: Bandera('china'),
    frase: '¡El dragón despierta!',
    arma: Arma(
      tipo: 'abanico',
      nombre: 'Artillería del dragón',
      color: Color(0xFFFFD54F),
      cadencia: _medio,
      dano: 11,
      apertura: 0.42,
    ),
    bomba: Bomba(tipo: 'escudo', nombre: 'Gran Muralla', color: Color(0xFFFFB74D)),
    naves: [
      Nave(nombre: 'J-20 Mighty Dragon', piloto: 'May. Li «Dragón» Wei', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2),
      Nave(nombre: 'J-10C Firebird', piloto: 'Cap. Zhang «Fénix» Hua', silueta: 'canard', velocidad: 4, poder: 4, bombas: 3),
    ],
  ),

  // ------------------------------------------------------------------ Europa ---
  Pais(
    id: 'espana',
    nombre: 'España',
    region: 'Europa',
    colores: [Color(0xFFAA151B), Color(0xFFF1BF00), Color(0xFFAA151B)],
    bandera: Bandera('h',
        franjas: [Color(0xFFAA151B), Color(0xFFF1BF00), Color(0xFFAA151B)],
        pesos: [1, 2, 1],
        emblema: Color(0xFFC8A951)),
    frase: '¡A por ellos!',
    arma: Arma(
      tipo: 'penetrante',
      nombre: 'Estoque aéreo',
      color: Color(0xFFFFEE58),
      cadencia: 0.18,
      dano: 16,
    ),
    bomba: Bomba(tipo: 'lluvia', nombre: 'Tomatina', color: Color(0xFFE53935)),
    naves: [
      Nave(nombre: 'Eurofighter Typhoon', piloto: 'Cap. Diego «Levante» Sánchez', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2),
      Nave(nombre: 'F/A-18 Hornet', piloto: 'Tte. Carmen «Flamenco» García', silueta: 'raptor', velocidad: 4, poder: 4, bombas: 3),
    ],
  ),
];

final Map<String, Pais> paisPorId = {for (final pais in paises) pais.id: pais};

/// Los países agrupados por región, que es como se enseñan en el selector.
List<MapEntry<String, List<Pais>>> paisesPorRegion() {
  final regiones = <String, List<Pais>>{};
  for (final pais in paises) {
    regiones.putIfAbsent(pais.region, () => []).add(pais);
  }
  return regiones.entries.toList();
}
