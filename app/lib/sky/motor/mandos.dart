/// Lo que el juego sabe de los controles.
///
/// El motor nunca pregunta por teclas ni por dedos: pide el estado de un
/// jugador y recibe siempre la misma forma. Así el mismo código vale para la
/// palanca táctil del móvil y para el teclado del escritorio, y añadir mandos
/// mañana no toca nada del juego.
library;

class EstadoMando {
  const EstadoMando({
    this.x = 0,
    this.y = 0,
    this.disparo = false,
    this.bomba = false,
    this.donar = false,
  });

  /// De -1 a 1 en cada eje.
  final double x;
  final double y;
  final bool disparo;
  final bool bomba;
  final bool donar;

  bool accion(String nombre) => switch (nombre) {
        'disparo' => disparo,
        'bomba' => bomba,
        'donar' => donar,
        _ => false,
      };
}

class Mandos {
  final List<EstadoMando> _actual = List.filled(4, const EstadoMando());
  List<EstadoMando> _previo = List.filled(4, const EstadoMando());

  /// La interfaz deja aquí lo que está tocando el jugador.
  void aplicar(int jugador, EstadoMando estado) {
    if (jugador < 0 || jugador >= _actual.length) return;
    _actual[jugador] = estado;
  }

  /// Se llama al principio de cada paso de simulación.
  ///
  /// Guardar el fotograma anterior es lo único que permite distinguir "está
  /// pulsando la bomba" de "acaba de pulsar la bomba", y sin esa distinción una
  /// sola pulsación gastaría las seis bombas.
  void nuevoFotograma() {
    _previo = List.of(_actual);
  }

  EstadoMando estado(int jugador) =>
      jugador >= 0 && jugador < _actual.length ? _actual[jugador] : const EstadoMando();

  bool pulsado(int jugador, String accion) {
    if (jugador < 0 || jugador >= _actual.length) return false;
    return _actual[jugador].accion(accion) && !_previo[jugador].accion(accion);
  }
}
