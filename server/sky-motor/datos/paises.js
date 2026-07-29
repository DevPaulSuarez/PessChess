/**
 * Los países jugables, con sus dos pilotos, su arma y su bomba.
 *
 * Esto es una tabla de datos, no de comportamiento: el arma dice *qué tipo* de
 * disparo usa (`armas.js` sabe hacerlos) y con qué números. Añadir un país es
 * añadir una entrada aquí, sin tocar el juego.
 *
 * Los pilotos son personajes de ficción. Donde el documento original nombraba
 * a una persona real se ha cambiado el nombre: un juego en el que se dispara
 * no es sitio para poner a nadie que exista.
 */

/** Cadencias de referencia, en segundos entre disparos. */
const RAPIDO = 0.1;
const MEDIO = 0.14;
const LENTO = 0.22;

export const PAISES = [
  // ---------------------------------------------------------------- Norteamérica
  {
    id: 'usa',
    nombre: 'Estados Unidos',
    region: 'América del Norte',
    colores: ['#3c3b6e', '#ffffff', '#b22234'],
    bandera: { tipo: 'usa' },
    frase: '¡En el aire no hay fronteras!',
    arma: {
      tipo: 'guiado',
      nombre: 'Misiles guiados por láser',
      color: '#ffe082',
      cadencia: MEDIO,
      dano: 11,
    },
    bomba: { tipo: 'barrido', nombre: 'Ataque aéreo B-2', color: '#90caf9' },
    naves: [
      { nombre: 'F-35 Lightning II', piloto: 'Cap. Jackson «Thunder» Reed', silueta: 'caza', velocidad: 4, poder: 4, bombas: 3 },
      { nombre: 'F-22 Raptor', piloto: 'Cte. Sarah «Viper» Chen', silueta: 'raptor', velocidad: 5, poder: 3, bombas: 2 },
    ],
  },
  {
    id: 'mexico',
    nombre: 'México',
    region: 'América del Norte',
    colores: ['#006847', '#ffffff', '#ce1126'],
    bandera: { tipo: 'v', franjas: ['#006847', '#ffffff', '#ce1126'], emblema: '#8d6e3c' },
    frase: '¡Vamos con todo!',
    arma: {
      tipo: 'plasma',
      nombre: 'Cañón de plasma azul',
      color: '#4fc3f7',
      cadencia: LENTO,
      dano: 26,
      alcance: 260, // corto: el plasma se apaga a media pantalla
    },
    bomba: { tipo: 'pantalla', nombre: 'Fuerza del Sol', color: '#ffd54f' },
    naves: [
      { nombre: 'F-5E Tiger II', piloto: 'Tte. Diego «Águila» Morales', silueta: 'caza', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'T-6C Texan II', piloto: 'Cap. Frida «Jaguar» López', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
    ],
  },

  // ------------------------------------------------------------- Centroamérica
  {
    id: 'guatemala',
    nombre: 'Guatemala',
    region: 'América Central',
    colores: ['#4997d0', '#ffffff', '#4997d0'],
    bandera: { tipo: 'v', franjas: ['#4997d0', '#ffffff', '#4997d0'], emblema: '#4d7c3a' },
    frase: '¡Por el quetzal!',
    arma: {
      tipo: 'abanico',
      nombre: 'Cañones rotativos laterales',
      color: '#aed581',
      cadencia: MEDIO,
      dano: 9,
      apertura: 0.5,
    },
    bomba: { tipo: 'lluvia', nombre: 'Erupción', color: '#ff8a65' },
    naves: [
      { nombre: 'A-37B Dragonfly', piloto: 'Sgto. Carlos «Quetzal» Estrada', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'AC-47 Spooky', piloto: 'Tte. Ana «Volcán» Castellanos', silueta: 'bimotor', velocidad: 2, poder: 5, bombas: 4 },
    ],
  },
  {
    id: 'salvador',
    nombre: 'El Salvador',
    region: 'América Central',
    colores: ['#0f47af', '#ffffff', '#0f47af'],
    bandera: { tipo: 'h', franjas: ['#0f47af', '#ffffff', '#0f47af'], emblema: '#d4a017' },
    frase: '¡Con fuego en el alma!',
    arma: {
      tipo: 'enjambre',
      nombre: 'Ráfaga de cohetes',
      color: '#ff7043',
      cadencia: RAPIDO,
      dano: 6,
      dispersion: 0.22,
    },
    bomba: { tipo: 'lluvia', nombre: 'Tormenta Tropical', color: '#4dd0e1' },
    naves: [
      { nombre: 'Cessna A-37B', piloto: 'Cap. Roberto «Cacao» Martínez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'IA-58 Pucará', piloto: 'Tte. Lucía «Flama» Rivas', silueta: 'bimotor', velocidad: 3, poder: 4, bombas: 3 },
    ],
  },
  {
    id: 'honduras',
    nombre: 'Honduras',
    region: 'América Central',
    colores: ['#0073cf', '#ffffff', '#0073cf'],
    bandera: { tipo: 'h', franjas: ['#0073cf', '#ffffff', '#0073cf'], emblema: '#0073cf' },
    frase: '¡Adelante, catrachos!',
    arma: {
      tipo: 'penetrante',
      nombre: 'Cañón de iones',
      color: '#b39ddb',
      cadencia: LENTO,
      dano: 18,
    },
    bomba: { tipo: 'pantalla', nombre: 'Marea', color: '#4fc3f7' },
    naves: [
      { nombre: 'F-86 Sabre', piloto: 'May. Pedro «Garza» Aguilar', silueta: 'caza', velocidad: 3, poder: 4, bombas: 3 },
      { nombre: 'Super Tucano', piloto: 'Cap. María «Coral» Fernández', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
    ],
  },
  {
    id: 'nicaragua',
    nombre: 'Nicaragua',
    region: 'América Central',
    colores: ['#0067c6', '#ffffff', '#0067c6'],
    bandera: { tipo: 'h', franjas: ['#0067c6', '#ffffff', '#0067c6'], emblema: '#f5c542' },
    frase: '¡Que arda el cielo!',
    arma: {
      tipo: 'plasma',
      nombre: 'Lanzallamas aéreo',
      color: '#ffab40',
      cadencia: 0.06,
      dano: 7,
      alcance: 150, // el fuego no llega lejos, pero lo que toca lo funde
    },
    bomba: { tipo: 'columna', nombre: 'Momotombo', color: '#ff7043' },
    naves: [
      { nombre: 'L-39 Albatros', piloto: 'Cte. José «Volcán» Ortega', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'MiG-21', piloto: 'Tte. Elena «Lago» Ruiz', silueta: 'interceptor', velocidad: 5, poder: 3, bombas: 2 },
    ],
  },
  {
    id: 'costarica',
    nombre: 'Costa Rica',
    region: 'América Central',
    colores: ['#002b7f', '#ffffff', '#ce1126'],
    bandera: { tipo: 'h', franjas: ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'], pesos: [1, 1, 2, 1, 1] },
    frase: '¡Pura vida!',
    arma: {
      tipo: 'abanico',
      nombre: 'Disparo ecológico en V',
      color: '#81c784',
      cadencia: MEDIO,
      dano: 10,
      apertura: 0.32,
    },
    bomba: { tipo: 'lluvia', nombre: 'Biodiversidad', color: '#a5d6a7' },
    naves: [
      { nombre: 'OV-10 Bronco', piloto: 'Cap. Andrés «Tucán» Soto', silueta: 'bimotor', velocidad: 3, poder: 4, bombas: 4 },
      { nombre: 'T-35 Pillán', piloto: 'Tte. Sofía «Mariposa» Mora', silueta: 'helice', velocidad: 4, poder: 3, bombas: 3 },
    ],
  },
  {
    id: 'panama',
    nombre: 'Panamá',
    region: 'América Central',
    colores: ['#005293', '#ffffff', '#da121a'],
    bandera: { tipo: 'panama' },
    frase: '¡Puente del mundo!',
    arma: {
      tipo: 'fragmenta',
      nombre: 'Torpedos aéreos',
      color: '#4db6ac',
      cadencia: 0.3,
      dano: 22,
      esquirlas: 6,
    },
    bomba: { tipo: 'escudo', nombre: 'Esclusa', color: '#4fc3f7' },
    naves: [
      { nombre: 'T-34 Mentor', piloto: 'May. Luis «Canal» Vega', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
      { nombre: 'A-29 Super Tucano', piloto: 'Cap. Diana «Istmo» Herrera', silueta: 'helice', velocidad: 4, poder: 4, bombas: 3 },
    ],
  },

  // ------------------------------------------------------------ América del Sur
  {
    id: 'colombia',
    nombre: 'Colombia',
    region: 'América del Sur',
    colores: ['#fcd116', '#003893', '#ce1126'],
    bandera: { tipo: 'h', franjas: ['#fcd116', '#003893', '#ce1126'], pesos: [2, 1, 1] },
    frase: '¡Arriba el tricolor!',
    arma: {
      tipo: 'fragmenta',
      nombre: 'Cañón de fragmentación',
      color: '#ffd54f',
      cadencia: 0.26,
      dano: 18,
      esquirlas: 8,
    },
    bomba: { tipo: 'lluvia', nombre: 'Café', color: '#8d6e63' },
    naves: [
      { nombre: 'Kfir C-10', piloto: 'Cap. Juan «Andino» García', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2 },
      { nombre: 'A-29B Super Tucano', piloto: 'Tte. Valentina «Orquídea» Ruiz', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
    ],
  },
  {
    id: 'venezuela',
    nombre: 'Venezuela',
    region: 'América del Sur',
    colores: ['#ffcc00', '#00247d', '#cf142b'],
    bandera: { tipo: 'h', franjas: ['#ffcc00', '#00247d', '#cf142b'], emblema: '#ffffff' },
    frase: '¡Desde el llano!',
    arma: {
      tipo: 'guiado',
      nombre: 'Misiles de crucero',
      color: '#ff8a80',
      cadencia: 0.2,
      dano: 13,
      giro: 2.4, // persiguen con calma: largo alcance, poca maniobra
    },
    bomba: { tipo: 'pantalla', nombre: 'Catatumbo', color: '#e1f5fe' },
    naves: [
      { nombre: 'Su-30MK2', piloto: 'May. Hugo «Llanero» Pérez', silueta: 'interceptor', velocidad: 4, poder: 5, bombas: 2 },
      { nombre: 'F-16A Fighting Falcon', piloto: 'Cap. Isabel «Ángel» Rodríguez', silueta: 'caza', velocidad: 5, poder: 3, bombas: 3 },
    ],
  },
  {
    id: 'ecuador',
    nombre: 'Ecuador',
    region: 'América del Sur',
    colores: ['#ffdd00', '#0072ce', '#ef3340'],
    bandera: { tipo: 'h', franjas: ['#ffdd00', '#0072ce', '#ef3340'], pesos: [2, 1, 1], emblema: '#7c5c2b' },
    frase: '¡Mitad del mundo!',
    arma: {
      tipo: 'rayo',
      nombre: 'Rayo de energía concentrado',
      color: '#80deea',
      cadencia: 0.04,
      dano: 3,
    },
    bomba: { tipo: 'columna', nombre: 'Ecuador', color: '#80deea' },
    naves: [
      { nombre: 'Mirage F1JE', piloto: 'Tte. Pablo «Galápagos» Torres', silueta: 'canard', velocidad: 4, poder: 4, bombas: 3 },
      { nombre: 'Cheetah C', piloto: 'Cap. Elena «Cotopaxi» Flores', silueta: 'canard', velocidad: 5, poder: 3, bombas: 3 },
    ],
  },
  {
    id: 'peru',
    nombre: 'Perú',
    region: 'América del Sur',
    colores: ['#d91023', '#ffffff', '#d91023'],
    bandera: { tipo: 'v', franjas: ['#d91023', '#ffffff', '#d91023'], emblema: '#c8a951' },
    frase: '¡Fuerza del Inca!',
    arma: {
      tipo: 'rebote',
      nombre: 'Discos ancestrales',
      color: '#ffd54f',
      cadencia: 0.2,
      dano: 12,
    },
    bomba: { tipo: 'pantalla', nombre: 'Machu Picchu', color: '#a1887f' },
    naves: [
      { nombre: 'MiG-29SMT', piloto: 'Cte. Miguel «Inca» Huamán', silueta: 'interceptor', velocidad: 5, poder: 4, bombas: 2 },
      { nombre: 'Su-25K', piloto: 'Tte. Rosa «Nazca» Quispe', silueta: 'ataque', velocidad: 3, poder: 5, bombas: 4 },
    ],
  },
  {
    id: 'bolivia',
    nombre: 'Bolivia',
    region: 'América del Sur',
    colores: ['#d52b1e', '#f9e300', '#007a33'],
    bandera: { tipo: 'h', franjas: ['#d52b1e', '#f9e300', '#007a33'] },
    frase: '¡Desde el altiplano!',
    arma: {
      tipo: 'recto',
      nombre: 'Cañón de sal',
      color: '#e0f7fa',
      cadencia: MEDIO,
      dano: 10,
      efecto: 'lento', // los cristales congelan el avance del enemigo
    },
    bomba: { tipo: 'escudo', nombre: 'Salar de Uyuni', color: '#e0f7fa' },
    naves: [
      { nombre: 'AT-33 Shooting Star', piloto: 'Cap. Ernesto «Altiplano» Mamani', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'T-34 Mentor', piloto: 'Tte. Carmen «Salar» Choque', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
    ],
  },
  {
    id: 'paraguay',
    nombre: 'Paraguay',
    region: 'América del Sur',
    colores: ['#d52b1e', '#ffffff', '#0038a8'],
    bandera: { tipo: 'h', franjas: ['#d52b1e', '#ffffff', '#0038a8'], emblema: '#f5c542' },
    frase: '¡Ñande rekove!',
    arma: {
      tipo: 'penetrante',
      nombre: 'Arpones aéreos',
      color: '#ffcc80',
      cadencia: 0.24,
      dano: 15,
      efecto: 'arrastre', // engancha al enemigo y lo tira hacia abajo
    },
    bomba: { tipo: 'columna', nombre: 'Itaipú', color: '#fff59d' },
    naves: [
      { nombre: 'EMB-312 Tucano', piloto: 'May. Antonio «Guaraní» González', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
      { nombre: 'AT-6 Texan II', piloto: 'Cap. Laura «Yguazú» Benítez', silueta: 'helice', velocidad: 4, poder: 3, bombas: 3 },
    ],
  },
  {
    id: 'uruguay',
    nombre: 'Uruguay',
    region: 'América del Sur',
    colores: ['#0038a8', '#ffffff', '#fcd116'],
    bandera: { tipo: 'h', franjas: ['#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff'], emblema: '#fcd116' },
    frase: '¡Vamo arriba!',
    arma: {
      tipo: 'onda',
      nombre: 'Cañón de ondas',
      color: '#81d4fa',
      cadencia: MEDIO,
      dano: 11,
      efecto: 'empuje',
    },
    bomba: { tipo: 'barrido', nombre: 'Gaucho', color: '#ffe082' },
    naves: [
      { nombre: 'A-37B Dragonfly', piloto: 'Cap. Martín «Plata» Rodríguez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
      { nombre: 'T-6C Texan II', piloto: 'Tte. Carolina «Punta» Silva', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
    ],
  },
  {
    id: 'argentina',
    nombre: 'Argentina',
    region: 'América del Sur',
    colores: ['#74acdf', '#ffffff', '#f6b40e'],
    bandera: { tipo: 'h', franjas: ['#74acdf', '#ffffff', '#74acdf'], emblema: '#f6b40e' },
    frase: '¡Vamos todavía!',
    arma: {
      tipo: 'guiado',
      nombre: 'Misiles Exocet',
      color: '#fff59d',
      cadencia: 0.18,
      dano: 15,
      giro: 4.2,
    },
    bomba: { tipo: 'barrido', nombre: 'Gloria', color: '#74acdf' },
    naves: [
      { nombre: 'IA-63 Pampa III', piloto: 'Cte. Javier «Pampero» Fernández', silueta: 'ligero', velocidad: 4, poder: 4, bombas: 3 },
      { nombre: 'A-4AR Fightinghawk', piloto: 'Cap. Natalia «Tango» Rossi', silueta: 'ataque', velocidad: 4, poder: 4, bombas: 3 },
    ],
  },
  {
    id: 'chile',
    nombre: 'Chile',
    region: 'América del Sur',
    colores: ['#0039a6', '#ffffff', '#d52b1e'],
    bandera: { tipo: 'chile' },
    frase: '¡Viento en popa!',
    arma: {
      tipo: 'recto',
      nombre: 'Cañón de viento',
      color: '#b3e5fc',
      cadencia: RAPIDO,
      dano: 8,
      efecto: 'empuje',
    },
    bomba: { tipo: 'pantalla', nombre: 'Calbuco', color: '#9e9e9e' },
    naves: [
      { nombre: 'F-16C Fighting Falcon', piloto: 'May. Sebastián «Andes» González', silueta: 'caza', velocidad: 5, poder: 4, bombas: 2 },
      { nombre: 'F-5E Tiger III', piloto: 'Tte. Fernanda «Atacama» Muñoz', silueta: 'caza', velocidad: 4, poder: 3, bombas: 3 },
    ],
  },

  // -------------------------------------------------------------------- Caribe
  {
    id: 'cuba',
    nombre: 'Cuba',
    region: 'Caribe',
    colores: ['#002a8f', '#ffffff', '#cf142b'],
    bandera: { tipo: 'cuba' },
    frase: '¡Dale, que se puede!',
    arma: {
      tipo: 'enjambre',
      nombre: 'Cohetes rápidos',
      color: '#ff8a65',
      cadencia: 0.08,
      dano: 5,
      dispersion: 0.3,
    },
    bomba: { tipo: 'pantalla', nombre: 'Estrella Solitaria', color: '#ef5350' },
    naves: [
      { nombre: 'MiG-23BN', piloto: 'Cte. Raúl «Habana» Ferrer', silueta: 'interceptor', velocidad: 4, poder: 4, bombas: 3 },
      { nombre: 'L-39 Albatros', piloto: 'Tte. Yolanda «Malecón» Martínez', silueta: 'ligero', velocidad: 4, poder: 3, bombas: 3 },
    ],
  },
  {
    id: 'dominicana',
    nombre: 'República Dominicana',
    region: 'Caribe',
    colores: ['#002d62', '#ffffff', '#ce1126'],
    bandera: { tipo: 'cruz' },
    frase: '¡Que suene el merengue!',
    arma: {
      tipo: 'onda',
      nombre: 'Ritmo caribeño',
      color: '#f48fb1',
      cadencia: 0.11,
      dano: 9,
      amplitud: 60,
    },
    bomba: { tipo: 'lluvia', nombre: 'Carnaval', color: '#f06292' },
    naves: [
      { nombre: 'T-35B Pillán', piloto: 'Cap. Pedro «Merengue» De León', silueta: 'helice', velocidad: 3, poder: 4, bombas: 4 },
      { nombre: 'A-29 Super Tucano', piloto: 'Tte. Ana «Bachata» Reyes', silueta: 'helice', velocidad: 4, poder: 4, bombas: 3 },
    ],
  },

  // ---------------------------------------------------------------------- Asia
  {
    id: 'china',
    nombre: 'China',
    region: 'Asia',
    colores: ['#de2910', '#ffde00', '#de2910'],
    bandera: { tipo: 'china' },
    frase: '¡El dragón despierta!',
    arma: {
      tipo: 'abanico',
      nombre: 'Artillería del dragón',
      color: '#ffd54f',
      cadencia: MEDIO,
      dano: 11,
      apertura: 0.42,
    },
    bomba: { tipo: 'escudo', nombre: 'Gran Muralla', color: '#ffb74d' },
    naves: [
      { nombre: 'J-20 Mighty Dragon', piloto: 'May. Li «Dragón» Wei', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2 },
      { nombre: 'J-10C Firebird', piloto: 'Cap. Zhang «Fénix» Hua', silueta: 'canard', velocidad: 4, poder: 4, bombas: 3 },
    ],
  },

  // -------------------------------------------------------------------- Europa
  {
    id: 'espana',
    nombre: 'España',
    region: 'Europa',
    colores: ['#aa151b', '#f1bf00', '#aa151b'],
    bandera: { tipo: 'h', franjas: ['#aa151b', '#f1bf00', '#aa151b'], pesos: [1, 2, 1], emblema: '#c8a951' },
    frase: '¡A por ellos!',
    arma: {
      tipo: 'penetrante',
      nombre: 'Estoque aéreo',
      color: '#ffee58',
      cadencia: 0.18,
      dano: 16,
    },
    bomba: { tipo: 'lluvia', nombre: 'Tomatina', color: '#e53935' },
    naves: [
      { nombre: 'Eurofighter Typhoon', piloto: 'Cap. Diego «Levante» Sánchez', silueta: 'canard', velocidad: 5, poder: 4, bombas: 2 },
      { nombre: 'F/A-18 Hornet', piloto: 'Tte. Carmen «Flamenco» García', silueta: 'raptor', velocidad: 4, poder: 4, bombas: 3 },
    ],
  },
];

export const PAIS_POR_ID = Object.fromEntries(PAISES.map((p) => [p.id, p]));

/** Los países agrupados por región, que es como se enseñan en el selector. */
export function paisesPorRegion() {
  const regiones = new Map();
  for (const pais of PAISES) {
    if (!regiones.has(pais.region)) regiones.set(pais.region, []);
    regiones.get(pais.region).push(pais);
  }
  return [...regiones];
}
