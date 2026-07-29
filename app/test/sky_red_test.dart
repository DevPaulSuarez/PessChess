import 'package:flutter_test/flutter_test.dart';

import 'package:pesschess/sky/red/sky_client.dart';

/// Un fotograma cualquiera, con lo justo para poder compararlo.
SkyMundo _mundo({required int gen, required int f}) => SkyMundo.fromJson({
      'f': f,
      'vuelo': gen,
      'vidas': 5,
      'puntos': 0,
      'stage': 0,
      'tuIndice': 0,
      'j': const [],
      'bj': const [],
      'be': const [],
      'en': const [],
      'pu': const [],
      'es': const [],
      'est': const [],
    });

void main() {
  group('Fotogramas que llegan por la red', () {
    test('el primero siempre se pinta', () {
      expect(esAtrasado(null, _mundo(gen: 1, f: 0)), isFalse);
    });

    test('uno más nuevo del mismo vuelo se pinta', () {
      expect(esAtrasado(_mundo(gen: 1, f: 10), _mundo(gen: 1, f: 11)), isFalse);
    });

    test('uno que se adelantó por el camino se tira', () {
      expect(esAtrasado(_mundo(gen: 1, f: 10), _mundo(gen: 1, f: 9)), isTrue);
    });

    test('al volver a despegar, el fotograma 0 del vuelo nuevo se pinta', () {
      // Este era el fallo: tras perder y despegar otra vez, el contador vuelve
      // a cero y la pantalla se quedaba congelada en la última imagen del vuelo
      // anterior porque todo lo nuevo parecía atrasado.
      final ultimoDelAnterior = _mundo(gen: 1, f: 20000);
      expect(esAtrasado(ultimoDelAnterior, _mundo(gen: 2, f: 0)), isFalse);
      expect(esAtrasado(ultimoDelAnterior, _mundo(gen: 2, f: 1)), isFalse);
    });

    test('y dentro del vuelo nuevo se vuelve a ordenar', () {
      expect(esAtrasado(_mundo(gen: 2, f: 5), _mundo(gen: 2, f: 4)), isTrue);
    });
  });
}
