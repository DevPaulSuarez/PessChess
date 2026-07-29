/**
 * Los escenarios: qué sale, cuándo sale y qué hay que hacer para que aparezca
 * el jefe de verdad.
 *
 * El guion es una lista de sucesos en orden. Cada uno espera unos segundos
 * desde el anterior, y los que "bloquean" no dejan seguir hasta que se cumple
 * algo (que no quede nadie en pantalla, normalmente). Con eso se escribe un
 * escenario entero sin una línea de código.
 *
 * Un escenario nuevo es una entrada más en esta lista.
 */

export const STAGES = [
  // =========================================================================
  {
    id: 'mexico',
    numero: 1,
    titulo: 'Despertar Global',
    lugar: 'Ciudad de México',
    ambiente: 'Amanecer sobre el Zócalo. La ciudad arde y el cielo está tomado.',
    fondo: 'ciudad',
    musica: {
      tempo: 140,
      bajo: [0, 0, null, 0, 3, null, 0, null, 5, 5, null, 5, 3, null, -2, null],
      arpa: [12, null, 15, null, 19, null, 15, null, 17, null, 20, null, 19, null, 15, null],
    },

    insignia: {
      tipo: 'campanas',
      pista: 'Las campanas de la catedral, de izquierda a derecha. Sin tocar los edificios.',
    },

    plantillas: {
      chupacabra: {
        forma: 'dron', movimiento: 'seno', radio: 12, vida: 22, puntos: 150,
        vy: 150, amplitud: 60, colores: ['#8d6e63', '#4e342e', '#ff8a65'],
      },
      jaguar: {
        forma: 'tanque', movimiento: 'suelo', radio: 18, vida: 90, puntos: 1200,
        vy: 60, colores: ['#6d4c41', '#3e2723', '#ffb300'],
        disparo: { cada: 2.1, tipo: 'directo', balas: 1, velocidad: 200, color: '#ffb300' },
      },
      quetzalcoatl: {
        forma: 'heli', movimiento: 'entrar', radio: 20, vida: 150, puntos: 3000,
        vy: 90, alturaParada: 150, colores: ['#00897b', '#004d40', '#b2ff59'],
        disparo: { cada: 2.6, tipo: 'espiral', balas: 5, velocidad: 165, color: '#b2ff59' },
      },
      aguila: {
        forma: 'ave', movimiento: 'picada', radio: 13, vida: 30, puntos: 500,
        velocidadPicada: 250, colores: ['#ffb300', '#e65100', '#fff8e1'],
      },
      campana: {
        forma: 'campana', movimiento: 'suelo', radio: 20, vida: 60, puntos: 800,
        vy: 34, categoria: 'escenario', colores: ['#bcaaa4', '#6d4c41', '#ffd54f'],
      },
      edificio: {
        forma: 'edificio', movimiento: 'suelo', radio: 26, vida: 220, puntos: 0,
        vy: 34, categoria: 'escenario', colores: ['#546e7a', '#263238', '#ffe082'],
      },
      tlaloc: {
        forma: 'torreta', movimiento: 'entrar', radio: 34, vida: 1800, puntos: 10000,
        vy: 70, alturaParada: 130, esMidBoss: true, colores: ['#0288d1', '#01579b', '#e1f5fe'],
        disparo: { cada: 1.5, tipo: 'abanico', balas: 7, velocidad: 175, color: '#81d4fa', apertura: 1.5 },
      },
    },

    guion: [
      { espera: 1.5, tipo: 'anuncio', texto: 'CIUDAD DE MÉXICO' },
      { espera: 1.5, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 12, formacion: 'uve' },
      { espera: 7, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 12, formacion: 'lados' },
      { espera: 7, tipo: 'oleada', plantilla: 'jaguar', cuantos: 4, formacion: 'suelo' },
      { espera: 8, tipo: 'oleada', plantilla: 'quetzalcoatl', cuantos: 3, formacion: 'fila' },
      { espera: 9, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 14, formacion: 'aleatoria' },
      { espera: 4, tipo: 'anuncio', texto: 'CATEDRAL METROPOLITANA' },
      { espera: 1, tipo: 'oleada', plantilla: 'edificio', cuantos: 2, formacion: 'lados' },
      { espera: 1.5, tipo: 'oleada', plantilla: 'campana', cuantos: 4, formacion: 'fila' },
      { espera: 10, tipo: 'anuncio', texto: '¡CUIDADO!' },
      { espera: 1, tipo: 'oleada', plantilla: 'tlaloc', cuantos: 1, formacion: 'centro' },
      { espera: 0, tipo: 'esperarLimpio' },
      { espera: 2, tipo: 'oleada', plantilla: 'jaguar', cuantos: 5, formacion: 'suelo' },
      { espera: 8, tipo: 'oleada', plantilla: 'quetzalcoatl', cuantos: 4, formacion: 'fila' },
      { espera: 9, tipo: 'oleada', plantilla: 'chupacabra', cuantos: 16, formacion: 'aleatoria' },
      { espera: 8, tipo: 'jefe' },
    ],

    jefe: {
      nombre: 'Huitzilopochtli',
      forma: 'colibri',
      radio: 52,
      altura: 130,
      colores: ['#00897b', '#004d40', '#ffd54f'],
      fases: [
        {
          nombre: 'Colibrí de guerra',
          vida: 0.35,
          movimiento: 'zigzag',
          ataques: [
            { cada: 1.5, tipo: 'abanico', balas: 9, velocidad: 190, apertura: 1.6, color: '#ffe082', forma: 'pluma' },
            { cada: 3.2, tipo: 'dirigido', balas: 3, velocidad: 250, color: '#fff59d' },
          ],
        },
        {
          nombre: 'Esfera solar',
          vida: 0.35,
          forma: 'esfera',
          movimiento: 'vaiven',
          ataques: [
            { cada: 1.8, tipo: 'circulo', balas: 8, velocidad: 165, giro: 0.4, color: '#ffb300' },
          ],
          invoca: { cada: 6, plantilla: 'aguila', cuantos: 2 },
        },
        {
          nombre: 'Ira divina',
          vida: 0.3,
          forma: 'esfera',
          movimiento: 'persigue',
          velocidadCaza: 130,
          ataques: [
            { cada: 1.1, tipo: 'circulo', balas: 10, velocidad: 195, giro: 0.9, color: '#ff5252' },
            { cada: 2.4, tipo: 'dirigido', balas: 5, velocidad: 275, color: '#ff8a80' },
            { cada: 3.6, tipo: 'lluvia', balas: 6, velocidad: 210, color: '#ffab91' },
          ],
        },
      ],
    },
  },

  // =========================================================================
  {
    id: 'amazonas',
    numero: 2,
    titulo: 'Selva Sagrada',
    lugar: 'Amazonas',
    ambiente: 'Niebla verde sobre el río. Algo se mueve bajo las copas.',
    fondo: 'selva',
    musica: {
      tempo: 124,
      bajo: [0, null, 0, null, -4, null, -4, null, -2, null, -2, null, 3, null, 0, null],
      arpa: [7, 12, null, 14, 15, null, 12, null, 10, 14, null, 15, 17, null, 14, null],
    },

    insignia: {
      tipo: 'silencio',
      pista: 'Sobre el río, quien no dispara ve cosas que los demás no ven.',
      segundos: 30,
    },

    plantillas: {
      anopheles: {
        forma: 'mosquito', movimiento: 'zigzag', radio: 9, vida: 12, puntos: 150,
        vy: 175, amplitud: 190, colores: ['#7cb342', '#33691e', '#c5e1a5'],
      },
      boto: {
        forma: 'barco', movimiento: 'suelo', radio: 20, vida: 120, puntos: 1200,
        vy: 55, colores: ['#455a64', '#263238', '#4dd0e1'],
        disparo: { cada: 2.4, tipo: 'directo', balas: 2, velocidad: 195, color: '#4dd0e1' },
      },
      iara: {
        // Sube desde abajo y se queda plantado: un árbol no persigue a nadie,
        // pero tampoco se marcha, así que hay que derribarlo.
        forma: 'arbol', movimiento: 'entrar', radio: 24, vida: 260, puntos: 3000,
        vy: 80, alturaParada: 170, colores: ['#2e7d32', '#1b5e20', '#aed581'],
        disparo: { cada: 2.8, tipo: 'abanico', balas: 6, velocidad: 150, color: '#aed581' },
      },
      delfin: {
        forma: 'submarino', movimiento: 'lateral', radio: 16, vida: 40, puntos: 500,
        vx: 90, categoria: 'escenario', colores: ['#f48fb1', '#ad1457', '#fce4ec'],
      },
      curupira: {
        forma: 'ave', movimiento: 'entrar', radio: 30, vida: 2000, puntos: 10000,
        vy: 80, alturaParada: 140, esMidBoss: true, colores: ['#ef6c00', '#bf360c', '#ffe082'],
        disparo: { cada: 1.3, tipo: 'espiral', balas: 6, velocidad: 185, color: '#ffab40' },
      },
    },

    guion: [
      { espera: 1.5, tipo: 'anuncio', texto: 'AMAZONAS' },
      { espera: 1.5, tipo: 'oleada', plantilla: 'anopheles', cuantos: 20, formacion: 'aleatoria' },
      { espera: 7, tipo: 'oleada', plantilla: 'anopheles', cuantos: 18, formacion: 'lados' },
      { espera: 7, tipo: 'oleada', plantilla: 'iara', cuantos: 2, formacion: 'lados' },
      { espera: 9, tipo: 'anuncio', texto: 'EL RÍO' },
      { espera: 0, tipo: 'zonaEspecial', zona: 'rio', duracion: 42 },
      { espera: 1, tipo: 'oleada', plantilla: 'boto', cuantos: 4, formacion: 'suelo' },
      { espera: 10, tipo: 'oleada', plantilla: 'boto', cuantos: 4, formacion: 'suelo' },
      { espera: 12, tipo: 'oleada', plantilla: 'anopheles', cuantos: 16, formacion: 'uve' },
      { espera: 10, tipo: 'anuncio', texto: '¡ALGO SE ACERCA!' },
      { espera: 1, tipo: 'oleada', plantilla: 'curupira', cuantos: 1, formacion: 'centro' },
      { espera: 0, tipo: 'esperarLimpio' },
      { espera: 2, tipo: 'oleada', plantilla: 'iara', cuantos: 3, formacion: 'fila' },
      { espera: 9, tipo: 'oleada', plantilla: 'anopheles', cuantos: 22, formacion: 'aleatoria' },
      { espera: 8, tipo: 'jefe' },
    ],

    jefe: {
      nombre: 'Anaconda Mecánica',
      forma: 'serpiente',
      radio: 34,
      altura: 120,
      velocidad: 150,
      colores: ['#43a047', '#1b5e20', '#ffd54f'],
      fases: [
        {
          nombre: 'Cinco anillos',
          vida: 0.3,
          movimiento: 'zigzag',
          requierePartes: true,
          deLaColaALaCabeza: true,
          partes: [
            { radio: 22, vida: 700, rastro: 40 },
            { radio: 22, vida: 700, rastro: 80 },
            { radio: 22, vida: 700, rastro: 120 },
            { radio: 22, vida: 700, rastro: 160 },
            { radio: 22, vida: 700, rastro: 200 },
          ],
          ataques: [
            { cada: 2.2, tipo: 'dirigido', balas: 3, velocidad: 200, color: '#aed581' },
          ],
        },
        {
          nombre: 'Cabeza suelta',
          vida: 0.4,
          movimiento: 'persigue',
          velocidadCaza: 110,
          ataques: [
            { cada: 2.6, tipo: 'veneno', balas: 4, color: 'rgba(120,220,120,.65)' },
            { cada: 1.6, tipo: 'abanico', balas: 7, velocidad: 185, apertura: 1.4, color: '#9ccc65' },
          ],
        },
        {
          nombre: 'Tres cabezas',
          vida: 0.3,
          movimiento: 'vaiven',
          requierePartes: true,
          partes: [
            { radio: 20, vida: 900, dx: -70, dy: 20 },
            { radio: 20, vida: 900, dx: 0, dy: -20 },
            { radio: 20, vida: 900, dx: 70, dy: 20 },
          ],
          ataques: [
            { cada: 1.4, tipo: 'circulo', balas: 9, velocidad: 180, giro: 0.6, color: '#7cb342' },
            { cada: 3, tipo: 'lluvia', balas: 5, velocidad: 200, color: '#c5e1a5' },
          ],
        },
      ],
    },
  },

  // =========================================================================
  {
    id: 'patagonia',
    numero: 3,
    titulo: 'Corazón de Hielo',
    lugar: 'Patagonia',
    ambiente: 'Ventisca sobre el glaciar. El viento empuja. Algo late bajo el hielo.',
    fondo: 'glaciar',
    viento: true,
    musica: {
      tempo: 152,
      bajo: [0, 0, 7, 0, 5, null, 3, null, 0, 0, 7, 0, -2, null, -4, null],
      arpa: [12, 19, null, 15, 12, null, 17, null, 14, 19, null, 15, 12, null, 10, null],
    },

    insignia: {
      tipo: 'icebergs',
      pista: 'Siete icebergs. Ni seis, ni ocho.',
      objetivo: 7,
    },

    plantillas: {
      pinguino: {
        forma: 'pinguino', movimiento: 'seno', radio: 12, vida: 26, puntos: 150,
        vy: 165, amplitud: 90, colores: ['#37474f', '#eceff1', '#ffb300'],
      },
      leopard: {
        forma: 'submarino', movimiento: 'entrar', radio: 20, vida: 160, puntos: 1200,
        vy: 95, alturaParada: 200, colores: ['#455a64', '#1c313a', '#4fc3f7'],
        disparo: { cada: 2.2, tipo: 'directo', balas: 2, velocidad: 215, color: '#4fc3f7' },
      },
      iceberg: {
        forma: 'iceberg', movimiento: 'suelo', radio: 24, vida: 70, puntos: 400,
        vy: 70, categoria: 'escenario', colores: ['#b3e5fc', '#4fc3f7', '#e1f5fe'],
      },
      esquirla: {
        forma: 'dron', movimiento: 'recto', radio: 8, vida: 14, puntos: 100,
        vy: 240, colores: ['#e1f5fe', '#81d4fa', '#ffffff'],
      },
      yeti: {
        forma: 'torreta', movimiento: 'entrar', radio: 36, vida: 2400, puntos: 10000,
        vy: 60, alturaParada: 125, esMidBoss: true, colores: ['#eceff1', '#90a4ae', '#4fc3f7'],
        disparo: { cada: 1.7, tipo: 'abanico', balas: 8, velocidad: 170, color: '#e1f5fe', apertura: 1.7 },
      },
    },

    guion: [
      { espera: 1.5, tipo: 'anuncio', texto: 'PATAGONIA' },
      { espera: 1.5, tipo: 'oleada', plantilla: 'pinguino', cuantos: 12, formacion: 'uve' },
      { espera: 7, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila' },
      { espera: 6, tipo: 'oleada', plantilla: 'leopard', cuantos: 3, formacion: 'fila' },
      { espera: 9, tipo: 'oleada', plantilla: 'pinguino', cuantos: 14, formacion: 'lados' },
      { espera: 7, tipo: 'anuncio', texto: 'TORMENTA DE HIELO' },
      { espera: 0.5, tipo: 'oleada', plantilla: 'esquirla', cuantos: 20, formacion: 'aleatoria' },
      { espera: 5, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila' },
      { espera: 6, tipo: 'oleada', plantilla: 'esquirla', cuantos: 18, formacion: 'aleatoria' },
      { espera: 6, tipo: 'anuncio', texto: '¡ALGO CAMINA SOBRE EL GLACIAR!' },
      { espera: 1, tipo: 'oleada', plantilla: 'yeti', cuantos: 1, formacion: 'centro' },
      { espera: 0, tipo: 'esperarLimpio' },
      { espera: 2, tipo: 'oleada', plantilla: 'iceberg', cuantos: 3, formacion: 'fila' },
      { espera: 6, tipo: 'oleada', plantilla: 'leopard', cuantos: 4, formacion: 'fila' },
      { espera: 9, tipo: 'oleada', plantilla: 'pinguino', cuantos: 16, formacion: 'aleatoria' },
      { espera: 8, tipo: 'jefe' },
    ],

    jefe: {
      nombre: 'Torre de Babel Helada',
      forma: 'torre',
      radio: 56,
      altura: 140,
      colores: ['#cfd8dc', '#607d8b', '#4fc3f7'],
      fases: [
        {
          nombre: 'Cuatro torretas',
          vida: 0.3,
          movimiento: 'vaiven',
          ritmo: 0.6,
          requierePartes: true,
          partes: [
            { radio: 16, vida: 600, dx: -60, dy: -30 },
            { radio: 16, vida: 600, dx: 60, dy: -30 },
            { radio: 16, vida: 600, dx: -60, dy: 30 },
            { radio: 16, vida: 600, dx: 60, dy: 30 },
          ],
          ataques: [
            { cada: 1.9, tipo: 'abanico', balas: 8, velocidad: 175, apertura: 1.5, color: '#81d4fa' },
          ],
        },
        {
          nombre: 'Despegue',
          vida: 0.35,
          movimiento: 'ascenso',
          ataques: [
            { cada: 1.2, tipo: 'lluvia', balas: 7, velocidad: 260, color: '#b0bec5' },
            { cada: 2.6, tipo: 'dirigido', balas: 3, velocidad: 230, color: '#4fc3f7' },
          ],
        },
        {
          nombre: 'Cañón orbital',
          vida: 0.35,
          movimiento: 'quieto',
          ataques: [
            { cada: 7, espera: 2, tipo: 'laser', duracion: 5.5, giro: 0.55, color: '#ff5252' },
            { cada: 2.1, tipo: 'circulo', balas: 8, velocidad: 170, giro: 0.5, color: '#90caf9' },
          ],
        },
      ],
    },
  },
];

/**
 * El jefe que sale cuando el equipo no cumplió las condiciones.
 *
 * Es el mismo para los tres escenarios y es ridículo a propósito: un mono en
 * una nave tirando plátanos. Verlo aparecer tiene que doler más que su
 * dificultad, que es ninguna.
 */
export const JEFE_SUSTITUTO = {
  nombre: 'Osaru',
  forma: 'mono',
  radio: 44,
  altura: 120,
  escalaVida: 0.5,
  colores: ['#8d6e63', '#5d4037', '#ffd54f'],
  fases: [
    {
      nombre: 'El mono espacial',
      vida: 1,
      movimiento: 'vaiven',
      ritmo: 0.7,
      ataques: [
        { cada: 2.4, tipo: 'abanico', balas: 4, velocidad: 130, apertura: 1.2, color: '#ffe082' },
      ],
    },
  ],
};

export const STAGE_POR_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
