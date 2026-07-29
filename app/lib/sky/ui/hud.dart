/// La interfaz durante la partida, dibujada en el mismo lienzo que el juego.
///
/// Regla de oro: el centro de la pantalla es sagrado. Todo lo que informa vive
/// arriba o abajo, porque en un matamarcianos lo que mata es no ver una bala.
library;

import 'package:flutter/painting.dart';

import '../motor/constantes.dart';
import '../motor/jefe.dart';
import '../motor/partida.dart';
import 'naves.dart';

/// Escribe texto en el lienzo. Devuelve el ancho pintado, por si hay que seguir.
double texto(
  Canvas canvas,
  String cadena,
  double x,
  double y, {
  double tam = 12,
  Color color = const Color(0xFFF0ECE8),
  TextAlign alineado = TextAlign.left,
  FontWeight peso = FontWeight.w700,
}) {
  final pintor = TextPainter(
    text: TextSpan(
      text: cadena,
      style: TextStyle(
        fontSize: tam,
        color: color,
        fontWeight: peso,
        // Sombra dura: el HUD tiene que leerse sobre un cielo claro y sobre uno
        // negro sin cambiar de color.
        shadows: const [Shadow(color: Color(0xC0000000), offset: Offset(1, 1.5))],
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  final dx = switch (alineado) {
    TextAlign.center => x - pintor.width / 2,
    TextAlign.right => x - pintor.width,
    _ => x,
  };
  pintor.paint(canvas, Offset(dx, y));
  return pintor.width;
}

void _barra(Canvas canvas, Rect caja, double fraccion, Color color) {
  canvas.drawRect(caja, Paint()..color = const Color(0x99000000));
  canvas.drawRect(
    Rect.fromLTWH(caja.left, caja.top, caja.width * fraccion.clamp(0, 1), caja.height),
    Paint()..color = color,
  );
  canvas.drawRect(
    caja.deflate(0.5),
    Paint()
      ..color = const Color(0x59FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1,
  );
}

void dibujarHUD(Canvas canvas, Partida partida) {
  _marcador(canvas, partida);
  final jefe = partida.jefe;
  if (jefe != null && jefe.viva) _barraDeJefe(canvas, jefe);
  _condiciones(canvas, partida);
  _panelJugadores(canvas, partida);
  _avisos(canvas, partida);
  _anuncio(canvas, partida);
  _rotulos(canvas, partida);
}

void _marcador(Canvas canvas, Partida partida) {
  texto(canvas, partida.puntos.toString().padLeft(8, '0'), anchoCampo / 2, 6,
      tam: 15, alineado: TextAlign.center, color: const Color(0xFFFFF8E1));

  // Vidas del bote común, el recurso que de verdad comparte el equipo.
  for (var i = 0; i < partida.vidasIniciales; i++) {
    canvas.drawCircle(
      Offset(12 + i * 11, 14),
      4,
      Paint()..color = i < partida.vidas ? const Color(0xFFEF5350) : const Color(0x2EFFFFFF),
    );
  }
}

void _barraDeJefe(Canvas canvas, Jefe jefe) {
  texto(canvas, jefe.nombre.toUpperCase(), anchoCampo / 2, 26,
      tam: 13, alineado: TextAlign.center, color: jefe.colores[2]);

  _barra(canvas, const Rect.fromLTWH(40, 44, anchoCampo - 80, 8), jefe.fraccionVida,
      jefe.vulnerable() ? const Color(0xFFEF5350) : const Color(0xFF78909C));

  for (var i = 0; i < jefe.def.fases.length; i++) {
    canvas.drawCircle(
      Offset(50 + i * 16, 62),
      4,
      Paint()..color = i <= jefe.faseIndice ? jefe.colores[2] : const Color(0x40FFFFFF),
    );
  }

  if (!jefe.vulnerable() && !jefe.entrando) {
    texto(canvas, 'NÚCLEO BLINDADO · DESTRUYE LAS PARTES', anchoCampo / 2, 70,
        tam: 9, alineado: TextAlign.center, color: const Color(0xFFFFD54F));
  }
}

/// Las tres condiciones del escenario, siempre a la vista.
///
/// Si el jugador no sabe qué se le pide, la ruta buena es una lotería.
/// Enseñarlo en todo momento convierte el sistema en una decisión: ¿persigo a
/// ese enemigo que se escapa, o me guardo la vida?
void _condiciones(Canvas canvas, Partida partida) {
  if (partida.jefe != null) return; // durante el jefe ya está todo decidido

  final porcentaje = partida.generados > 0 ? partida.destruidos / partida.generados : 0.0;
  const x = anchoCampo - 96.0;

  canvas.drawRRect(
    RRect.fromRectAndRadius(const Rect.fromLTWH(x - 6, 20, 100, 46), const Radius.circular(6)),
    Paint()..color = const Color(0x8C0A0807),
  );

  void linea(int i, bool cumple, String cadena) {
    texto(canvas, cumple ? '✔' : '·', x, 24 + i * 13.0,
        tam: 10, color: cumple ? const Color(0xFFAED581) : const Color(0xFF90A4AE));
    texto(canvas, cadena, x + 12, 24 + i * 13.0,
        tam: 9, color: cumple ? const Color(0xFFE8F5E9) : const Color(0xFFB0BEC5));
  }

  linea(0, porcentaje >= 0.85, 'Bajas ${(porcentaje * 100).round()}%');
  linea(1, partida.vidasPerdidas <= 1, 'Vidas −${partida.vidasPerdidas}');
  linea(2, partida.insignia, 'Insignia');
}

void _panelJugadores(Canvas canvas, Partida partida) {
  const alto = 34.0;
  const y = altoCampo - alto;
  final ancho = anchoCampo / partida.jugadores.length;

  canvas.drawRect(
    const Rect.fromLTWH(0, y, anchoCampo, alto),
    Paint()..color = const Color(0xB8080605),
  );

  for (var i = 0; i < partida.jugadores.length; i++) {
    final jugador = partida.jugadores[i];
    final x = i * ancho;

    canvas.drawRect(Rect.fromLTWH(x, y, 3, alto), Paint()..color = jugador.color);
    dibujarBandera(canvas, jugador.pais, Rect.fromLTWH(x + 8, y + 6, 18, 12));

    texto(canvas, 'J${i + 1}', x + 30, y + 4, tam: 10, color: jugador.color);
    if (!jugador.viva) {
      texto(canvas, 'CAÍDO', x + 48, y + 4, tam: 9, color: const Color(0xFFEF5350));
    }

    // Potencia: cuatro segmentos, que es el máximo del diseño.
    for (var n = 0; n < 4; n++) {
      canvas.drawRect(
        Rect.fromLTWH(x + 30 + n * 7, y + 20, 5, 5),
        Paint()..color = n < jugador.nivel ? const Color(0xFFFFD54F) : const Color(0x33FFFFFF),
      );
    }

    for (var b = 0; b < jugador.bombas; b++) {
      canvas.drawCircle(Offset(x + 66 + b * 8, y + 22), 3, Paint()..color = const Color(0xFF4FC3F7));
    }
  }
}

void _anuncio(Canvas canvas, Partida partida) {
  final anuncio = partida.anuncio;
  if (anuncio == null) return;

  // Entra deprisa y sale despacio: se lee sin tapar la acción mucho rato.
  final alfa = [
    1.0,
    (anuncio.restante / anuncio.total) * 3,
    anuncio.restante * 2.5,
  ].reduce((a, b) => a < b ? a : b).clamp(0.0, 1.0);

  texto(canvas, anuncio.texto, anchoCampo / 2, altoCampo / 2 - 70,
      tam: 22, alineado: TextAlign.center, color: const Color(0xFFFFF8E1).withValues(alpha: alfa));
}

void _rotulos(Canvas canvas, Partida partida) {
  for (final rotulo in partida.efectos.rotulos) {
    texto(canvas, rotulo.texto, rotulo.x, rotulo.y,
        tam: 13, alineado: TextAlign.center, color: rotulo.color.withValues(alpha: rotulo.opacidad));
  }
}

void _avisos(Canvas canvas, Partida partida) {
  const centro = anchoCampo / 2;

  if (partida.combinadoActivo > 0) {
    texto(canvas, '¡ATAQUE COMBINADO ×2.5!', centro, 92,
        tam: 12, alineado: TextAlign.center, color: const Color(0xFFFFD54F));
  }

  final insignia = partida.stage.insignia;

  if (insignia.tipo == 'silencio' && partida.zona == 'rio' && !partida.insignia) {
    texto(canvas, 'ALTO EL FUEGO SOBRE EL RÍO', centro, altoCampo - 74,
        tam: 10, alineado: TextAlign.center, color: const Color(0xFF81D4FA));
    _barra(canvas, const Rect.fromLTWH(centro - 60, altoCampo - 60, 120, 5),
        partida.silencio / insignia.segundos, const Color(0xFF4DD0E1));
  }

  if (insignia.tipo == 'icebergs' && !partida.insignia) {
    final pasado = partida.icebergsRotos > insignia.objetivo;
    texto(canvas, 'Icebergs: ${partida.icebergsRotos} / ${insignia.objetivo}', centro, altoCampo - 70,
        tam: 10,
        alineado: TextAlign.center,
        color: pasado ? const Color(0xFFEF5350) : const Color(0xFFB3E5FC));
  }

  if (partida.viento.abs() > 4) {
    texto(canvas, partida.viento > 0 ? '»»»' : '«««', centro, 78,
        tam: 14, alineado: TextAlign.center, color: const Color(0x99E1F5FE));
  }
}
