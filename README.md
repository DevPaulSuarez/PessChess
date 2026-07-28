# PessChess

Ajedrez para jugar por internet contra otra persona, desde el móvil.

- **`server/`** — Node + TypeScript. Valida las jugadas, lleva los relojes y
  retransmite las partidas por WebSocket.
- **`app/`** — Flutter para iOS y Android (y macOS, que se usa para probar).

El servidor es la única autoridad: el móvil no decide nunca si una jugada es
legal ni cuánto tiempo le queda a nadie. Solo dibuja lo que le llega y pide
mover. Por eso no se puede hacer trampa retocando la app.

## Qué se puede hacer

- Crear una partida y compartir un código de 4 caracteres con quien quieras.
- Entrar a una cola y jugar con la primera persona que pida el mismo ritmo.
- Ritmos de 5, 10, 10+5 y 30 minutos, o sin reloj.
- Reglas completas: enroque, captura al paso, coronación, jaque mate, rey
  ahogado, material insuficiente, repetición y regla de las 50 jugadas.
- Abandonar y ofrecer tablas.
- Volver a una partida si se cierra la app o se pierde la cobertura. El reloj
  sigue corriendo mientras tanto, así que se puede perder por tiempo estando
  desconectado.

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
# Servidor: 46 comprobaciones contra el servidor real, con dos clientes.
cd server && npm run dev &      # el servidor debe estar levantado
cd server && npm test

# App: 13 pruebas de lógica e interfaz, sin red.
cd app && flutter test

# App de extremo a extremo: la interfaz real juega contra el servidor real,
# con un segundo jugador simulado. También requiere el servidor levantado.
cd app && flutter test integration_test -d macos
```

## Detalles que conviene saber

**Los códigos de sala** no usan `I`, `O`, `0` ni `1`, porque se confunden al
leerlos en voz alta o en pantalla. Se escriben en mayúsculas pero la app acepta
minúsculas.

**Las jugadas legales las manda el servidor** junto con cada posición. La app no
lleva ninguna lógica de ajedrez: por eso resalta los destinos posibles al
instante, sin consultar nada, y por eso no puede equivocarse respecto al
servidor.

**Las partidas viven en memoria.** Si se reinicia el servidor, se pierden. Para
un uso serio habría que guardarlas en una base de datos; para jugar entre
amigos, no hace falta.

**Los relojes** los lleva el servidor. La app los anima entre mensaje y mensaje
para que se vean fluidos, pero quien decide si alguien se quedó sin tiempo es
siempre el servidor. Si a un jugador se le acaba el tiempo pero al rival no le
queda material para dar mate, la partida es tablas y no derrota.
