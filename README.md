# PessChess

Juegos para jugar por internet con otra gente, desde el móvil: **ajedrez**,
**damas**, **reversi**, una batalla de **tanques** y un matamarcianos
cooperativo, **Sky Warriors United**. Todo se juega desde la aplicación; no hay
versión de navegador.

- **`server/`** — Node + TypeScript. Valida las jugadas, lleva los relojes y
  retransmite las partidas por WebSocket.
- **`app/`** — Flutter para iOS y Android (y macOS, que se usa para probar).
- **`server/sky-motor/`** — el motor del matamarcianos, en JavaScript suelto.
  Corre en el servidor, que es quien lleva el mundo: los móviles solo pintan.

El servidor es la única autoridad: el móvil no decide nunca si una jugada es
legal ni cuánto tiempo le queda a nadie. Solo dibuja lo que le llega y pide
mover. Por eso no se puede hacer trampa retocando la app.

## Qué se puede hacer

- Elegir juego: ajedrez, damas o reversi. Las salas, los relojes, el
  emparejamiento y la reconexión son los mismos para los tres.
- Crear una partida y compartir un código de 4 caracteres con quien quieras.
- Entrar a una cola y jugar con la primera persona que pida el mismo ritmo.
- Ritmos de 5, 10, 10+5 y 30 minutos, o sin reloj.
- Ajedrez con reglas completas: enroque, captura al paso, coronación, jaque
  mate, rey ahogado, material insuficiente, repetición y regla de las 50
  jugadas.
- Damas con dama voladora y sin obligación de comer.
- Reversi con el paso automático a quien no tiene dónde colocar, y el marcador
  de fichas siempre a la vista.
- Abandonar y ofrecer tablas.
- Volver a una partida si se cierra la app o se pierde la cobertura. El reloj
  sigue corriendo mientras tanto, así que se puede perder por tiempo estando
  desconectado.

## Sky Warriors United

Un matamarcianos vertical al estilo de las recreativas de 16 bits, para hasta
cuatro pilotos, **cada uno desde su móvil**. Se crea una escuadrilla, se comparte
un código de 4 caracteres —igual que una sala de ajedrez— y los cuatro vuelan el
mismo escenario.

**Lo que lo hace distinto de un matamarcianos cualquiera:**

- **Jugar en equipo es más difícil, no más fácil.** Cada jugador multiplica la
  dificultad (×1.6, ×2.4, ×3.5), trae más enemigos, más proyectiles por ataque
  y un jefe con más vida. Y el juego aprieta más cuanto peor va el equipo.
- **Las vidas se comparten.** Desde dos jugadores hay un solo bote común: quien
  muere se lo gasta a todos. Cuando llega a cero, se acabó para todos.
- **Al jefe de verdad hay que ganárselo.** En cada escenario hay tres
  condiciones —abatir el 85% de los enemigos, no perder más de una vida y
  encontrar la insignia escondida— y hay que cumplir dos. Si no, baja un jefe
  sustituto ridículo y el equipo cae en la Ruta de la Vergüenza.
- **Mecánicas que obligan a cooperar.** Tres jugadores disparando al mismo
  enemigo hacen ×2.5 de daño; dos volando juntos levantan un escudo entre
  ellos; se puede donar potencia propia a cambio de una vida para el equipo; y
  si todos sueltan la bomba en el mismo segundo, se funden en un Armagedón.
- **Veintiún países**, cada uno con dos pilotos, su arma y su bomba. Se empieza
  con dos —Estados Unidos y Perú— y los demás se ganan volando: terminar un
  escenario abre uno, ganarse al jefe de verdad abre otro y hacerlo perfecto,
  un tercero. Ni una campaña impecable los abre todos, así que hay a dónde
  volver. El progreso lo lleva el servidor, no el móvil, por lo mismo que las
  jugadas del ajedrez.

**Controles.** La nave persigue al dedo y dispara sola; la bomba y la donación
son botones en pantalla.

Están hechos los tres primeros escenarios del diseño (Ciudad de México, el
Amazonas y la Patagonia), cada uno con su mid-boss y su jefe de tres fases.
Añadir un escenario o un país es añadir una entrada en `sky-motor/datos/`, sin
tocar el motor.

## Poner en marcha

Hace falta Node 20 o superior y Flutter 3.41 o superior.

### 1. El servidor

```bash
cd server
npm install
npm run dev      # escucha en el puerto 3000
```

Para comprobar que responde: `curl http://localhost:3000/health`

### 2. La app

```bash
cd app
flutter pub get
flutter run          # elige el dispositivo cuando lo pregunte
```

### 3. Desarrollar contra el servidor de tu máquina

La app viene apuntando al servidor publicado, así que se juega de verdad sin
tocar nada. Para probar contra el servidor local hay que pedirlo:

```bash
flutter run --dart-define=SERVER_URL=http://localhost:3000
```

Desde un móvil físico, `localhost` es el propio móvil y no vale: hay que poner
la IP del ordenador (`ipconfig getifaddr en0`) y estar en la misma wifi.

Para jugar **entre países** no basta con la red local: el servidor tiene que
estar publicado en internet con una dirección `https://`. Está explicado más
abajo.

## Publicar el servidor en un VPS

Sin Docker: es un proceso de Node normal y corriente. Consume unos **90 MB de
memoria**, así que entra sin problema en el servidor más pequeño que vendan.
Todo lo necesario está en `server/deploy/`.

### Preparar el servidor (una sola vez)

```bash
# En el VPS, como root:
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -   # Node 24
apt install -y nodejs

useradd --system --home /opt/pesschess --shell /usr/sbin/nologin pesschess
mkdir -p /opt/pesschess && chown pesschess:pesschess /opt/pesschess
```

Después el servicio y el proxy con HTTPS:

```bash
cp deploy/pesschess.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now pesschess

# HTTPS: con Caddy si el servidor no tiene otro servidor web (se encarga solo
# del certificado), o con nginx si ya lo estás usando para otras cosas.
cp deploy/Caddyfile /etc/caddy/Caddyfile      # cambiando el dominio
systemctl reload caddy
```

El fichero de systemd le pone un techo de 256 MB al servicio: si algo se
desmadrase, systemd lo reinicia en vez de dejar que el servidor se quede sin
memoria y empiece a matar procesos al azar.

### Publicar una versión nueva

```bash
cd server
./deploy/publicar.sh usuario@mi-servidor.com
```

Compila, sube solo el JavaScript resultante, instala las dependencias allí
(algunas se compilan para cada sistema, y las de un Mac no sirven en Linux),
reinicia el servicio y comprueba que responde.

### La dirección del servidor en la app

La app ya viene apuntando a `https://ajedrez.devpess.com`, así que funciona
nada más instalarla y nadie tiene que configurar nada:

```bash
flutter build apk        # Android
flutter build ipa        # iOS
```

Un servidor publicado tiene que ir por `https://`. Con `http://` iOS bloquea la
conexión, y Android también a partir de la versión 9.

## Pruebas

```bash
# Servidor: 66 comprobaciones contra el servidor real, con dos clientes.
cd server && npm run dev &      # el servidor debe estar levantado
cd server && npm test

# Reglas de cada juego, sin red ni servidor (requiere `npm run build` antes):
# 42 comprobaciones de damas y 32 de reversi.
cd server && npm run test:damas
cd server && npm run test:reversi

# Sky Warriors: 71 comprobaciones de dificultad, puntuación, datos y
# desbloqueos, y 44 de simulación (juega los tres escenarios enteros contra un
# lienzo de mentira). Las de red y las del editor necesitan el
# servidor levantado (42 y 37).
cd server && npm run test:sky
cd server && npm run test:sky-sim
cd server && npm run test:sky-red
cd server && npm run test:sky-editor

# Tanques: 112 de la arena y 36 de la sala por la red.
cd server && npm run test:tanques
cd server && npm run test:tanques-red

# App: 63 pruebas de lógica e interfaz, sin red.
cd app && flutter test

# Sky Warriors de extremo a extremo: la app crea la escuadrilla, elige país
# —solo entre los desbloqueados—, despega y pilota, con un segundo piloto
# simulado. Los ficheros de integración van de uno en uno: encadenados, el
# segundo no llega a arrancar la app en macOS.
cd app && flutter test integration_test/sky_red_test.dart -d macos

# App de extremo a extremo: la interfaz real juega contra el servidor real,
# con un segundo jugador simulado. También requiere el servidor levantado.
cd app && flutter test integration_test -d macos
```

## Detalles que conviene saber

**Los países y los escenarios se pueden retocar sin tocar código**, desde
`http://localhost:3000/editor/sky.html`: colores, bandera, arma —con el color y
la forma de sus balas—, bomba, las dos naves de cada país y la vida, los puntos
y los colores de cada enemigo. A cada nave se le puede **subir su propio dibujo**
(PNG o JPG, hasta 600 kB): se guarda en el servidor, se sirve desde `/sky-naves/`
y el móvil lo pinta en lugar de la silueta, encajado sin deformarlo. Mientras la
imagen llega —o si falla— se vuela con la silueta de siempre. Lo que se guarda es **solo lo que cambias**, en
`data/sky-datos.json`, encima de los datos del código: así un retoque que
estropee un país se deshace con «Volver al original», los que no tocas siguen
siendo los de siempre, y un país nuevo que se añada al código llega igual a
quien ya había editado algo. Los cambios valen desde la partida siguiente, sin
reiniciar. La vista previa usa el mismo pintor que el juego, así que lo que se
ve en el editor es lo que se verá volando.

**Los códigos de sala** no usan `I`, `O`, `0` ni `1`, porque se confunden al
leerlos en voz alta o en pantalla. Se escriben en mayúsculas pero la app acepta
minúsculas.

**Las jugadas legales las manda el servidor** junto con cada posición. La app no
lleva ninguna lógica de ajedrez: por eso resalta los destinos posibles al
instante, sin consultar nada, y por eso no puede equivocarse respecto al
servidor.

**En reversi no se mueve nada, se coloca**, así que sus jugadas salen y llegan
a la misma casilla (`d6` → `d6`). Es lo que permite que el mismo protocolo y el
mismo tablero valgan para los tres juegos: donde hay jugadas de ese tipo, la
app marca las casillas de entrada y juega al primer toque, sin seleccionar
ninguna ficha antes.

**Sky Warriors se prueba sin pantalla.** Sus reglas no la necesitan: la
simulación juega escenarios completos a sesenta pasos por segundo y dibuja cada
fotograma contra un lienzo de mentira. Recorre las tres fases de cada jefe en
segundos, algo que a mano llevaría media hora, y ya ha cazado así un par de
fallos que solo se veían al morir un jefe.

**El motor del matamarcianos está en JavaScript suelto**, en `sky-motor/`, y no
en TypeScript como el resto del servidor. Es de cuando el juego corría en el
navegador. Al llevarlo a la red se prefirió moverlo tal cual —ya estaba entero y
probado— antes que reescribirlo: un segundo motor en otro lenguaje habría que
mantenerlo en paralelo y se desviaría del primero a la primera semana. El
servidor lo carga con una ruta que vale igual desde `src/` que desde `dist/`.

**En el matamarcianos el mundo va a 60 pasos por segundo y sale a 30.** El motor
está escrito para 60 y ahí se queda, pero mandar los treinta fotogramas
intermedios no se nota en un móvil y sí en la factura de datos. Todo viaja en
listas de números con una tabla de colores aparte: con nombres, cada bala
costaría cinco veces más y en pantalla hay cien.

**Una partida con semilla sale siempre igual.** Todo lo que el juego sortea
—oleadas, viento, premios, la dispersión del enjambre— sale del generador de la
partida, y `Partida(..., semilla: 7)` lo fija. Jugando de verdad no se pone y
cada partida es distinta; en las pruebas es obligatorio, porque una simulación
que sortea a su aire falla una vez de cada diez y no dice nada de nadie.

**Las partidas viven en memoria.** Si se reinicia el servidor, se pierden. Para
un uso serio habría que guardarlas en una base de datos; para jugar entre
amigos, no hace falta.

**Los relojes** los lleva el servidor. La app los anima entre mensaje y mensaje
para que se vean fluidos, pero quien decide si alguien se quedó sin tiempo es
siempre el servidor. Si a un jugador se le acaba el tiempo pero al rival no le
queda material para dar mate, la partida es tablas y no derrota.
