import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

/// Los dibujos que se han subido para las naves.
///
/// Una nave puede traer su propio PNG en vez de la silueta que dibuja el juego.
/// La imagen se pide una sola vez y se queda en memoria: pedirla en cada
/// fotograma sería sesenta descargas por segundo, y decodificarla otras tantas.
///
/// Mientras no haya llegado, se sigue volando con la silueta de siempre. Que
/// una imagen tarde o falle no puede dejar a nadie sin nave.
class ImagenesDeNaves {
  ImagenesDeNaves._();

  static final ImagenesDeNaves instancia = ImagenesDeNaves._();

  final Map<String, ui.Image> _cargadas = {};
  final Set<String> _pidiendo = {};

  /// Se dispara cuando llega una imagen nueva, para repintar.
  final ValueNotifier<int> alLlegar = ValueNotifier(0);

  /// La imagen de esa ruta, si ya está. Si no, la pide y devuelve null.
  ui.Image? imagen(String? ruta, {required String servidor}) {
    if (ruta == null || ruta.isEmpty) return null;

    final ya = _cargadas[ruta];
    if (ya != null) return ya;

    _pedir(ruta, servidor);
    return null;
  }

  Future<void> _pedir(String ruta, String servidor) async {
    if (_pidiendo.contains(ruta)) return;
    _pidiendo.add(ruta);

    try {
      final url = Uri.parse(ruta.startsWith('http') ? ruta : '$servidor$ruta');
      final cliente = HttpClient();
      final respuesta = await cliente.getUrl(url).then((r) => r.close());
      if (respuesta.statusCode != 200) return;

      final bytes = await consolidateHttpClientResponseBytes(respuesta);
      final codec = await ui.instantiateImageCodec(bytes);
      final fotograma = await codec.getNextFrame();

      _cargadas[ruta] = fotograma.image;
      alLlegar.value++;
    } catch (_) {
      // Sin imagen se vuela con la silueta: no hay nada que avisar.
    } finally {
      _pidiendo.remove(ruta);
    }
  }

  /// Para las pruebas y para cuando se cambia de servidor.
  void olvidar() {
    _cargadas.clear();
    _pidiendo.clear();
  }
}
