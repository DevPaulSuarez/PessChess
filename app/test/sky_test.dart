import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';

import 'package:pesschess/sky/datos/paises.dart';
import 'package:pesschess/sky/datos/stages.dart';
import 'package:pesschess/sky/motor/armas.dart';
import 'package:pesschess/sky/motor/constantes.dart';
import 'package:pesschess/sky/motor/dificultad.dart';
import 'package:pesschess/sky/motor/enemigos.dart';
import 'package:pesschess/sky/motor/jefe.dart';
import 'package:pesschess/sky/motor/mandos.dart';
import 'package:pesschess/sky/motor/partida.dart';
import 'package:pesschess/sky/motor/puntuacion.dart';
import 'package:pesschess/sky/ui/hud.dart';
import 'package:pesschess/sky/ui/naves.dart';

/// Alineación de pruebas: siempre los mismos países, para que nada dependa del
/// azar salvo lo que el propio juego sortea.
List<Alineacion> _alineaciones(int cuantos) {
  const ids = ['mexico', 'usa', 'peru', 'espana'];
  return List.generate(cuantos, (i) {
    final pais = paisPorId[ids[i]]!;
    return Alineacion(pais, pais.naves[i % 2]);
  });
}

/// Un lienzo de verdad que no llega a pintarse en pantalla.
///
/// Sirve para ejercitar todo el código de dibujo —naves, jefes, HUD, fondos— sin
/// abrir una ventana. Si algo lanza al pintar, la prueba se entera.
({Canvas canvas, PictureRecorder grabadora}) lienzoDePruebas() {
  final grabadora = PictureRecorder();
  return (canvas: Canvas(grabadora), grabadora: grabadora);
}

/// Resultado de jugar un escenario entero con piloto automático.
class _Simulacion {
  _Simulacion(this.partida, this.fasesVistas, this.maxEnemigos, this.maxBalas);

  final Partida partida;
  final int fasesVistas;
  final int maxEnemigos;
  final int maxBalas;
}

/// Juega un escenario de principio a fin.
///
/// El piloto automático persigue a quien tenga delante y dispara: no pretende
/// jugar bien, pretende tocar todo lo que tocaría una persona. Se le hace
/// invulnerable porque no esquiva, y al jefe se le pega con la misma llamada
/// que usan las colisiones para recorrer sus tres fases en segundos.
_Simulacion _jugarStage(Stage stage, int numJugadores, {bool cumplirCondiciones = false}) {
  final partida = Partida(stage: stage, alineaciones: _alineaciones(numJugadores), semilla: 7);
  final mandos = Mandos();
  final (:canvas, :grabadora) = lienzoDePruebas();

  var fasesVistas = 0;
  var maxEnemigos = 0;
  var maxBalas = 0;

  for (var i = 0; i < 60 * 500; i++) {
    if (cumplirCondiciones && partida.jefe == null) {
      partida.destruidos = partida.generados;
      partida.insignia = true;
    }

    for (final jugador in partida.jugadores) {
      jugador.invulnerable = 99;
      jugador.nivel = 4;

      // Va a por el enemigo más cercano y se queda a media altura: lo bastante
      // arriba para que llegue un arma corta como el plasma mexicano, lo
      // bastante abajo para tener sitio.
      final objetivo = partida.jefe?.viva ?? false
          ? partida.jefe!
          : partida.enemigos.where((e) => e.y > 0 && e.categoria == 'enemigo').firstOrNull;
      double hacia(double actual, double destino) =>
          (destino - actual).abs() < 8 ? 0 : (destino - actual).sign;

      mandos.aplicar(
        jugador.indice,
        EstadoMando(
          x: hacia(jugador.x, objetivo?.x ?? anchoCampo / 2),
          y: hacia(jugador.y, 330),
          disparo: true,
        ),
      );
    }

    mandos.nuevoFotograma();
    partida.actualizar(paso, mandos);

    maxEnemigos = math.max(maxEnemigos, partida.enemigos.length);
    maxBalas = math.max(maxBalas, partida.balasEnemigo.length + partida.balasJugador.length);

    final jefe = partida.jefe;
    if (jefe != null && jefe.viva && !jefe.entrando) {
      fasesVistas = math.max(fasesVistas, jefe.faseIndice + 1);
      for (final parte in jefe.partesVulnerables()) {
        jefe.golpear(400, 0, partida, parte);
      }
      if (jefe.vulnerable()) jefe.golpear(900, 0, partida);
    }

    // Dibujar en cada paso: es donde se esconde la mitad de los errores.
    partida.dibujar(canvas);
    dibujarHUD(canvas, partida);

    if (partida.estado != EstadoPartida.jugando) break;
  }

  grabadora.endRecording().dispose();
  return _Simulacion(partida, fasesVistas, maxEnemigos, maxBalas);
}

void main() {
  group('Dificultad', () {
    test('sube con cada jugador y nunca baja', () {
      expect(multiplicadorJugadores[1], 1.0);
      expect(multiplicadorJugadores[4], 3.5);
      for (var n = 2; n <= 4; n++) {
        expect(multiplicadorJugadores[n]!, greaterThan(multiplicadorJugadores[n - 1]!));
      }
    });

    test('las vidas se comparten y son menos por cabeza', () {
      expect(vidasDelEquipo(1), 3);
      expect(vidasDelEquipo(4), 10);
      expect(vidasEquipo[4]! / 4, lessThan(vidasEquipo[1]!));
    });

    test('aprieta cuando al equipo le queda poco', () {
      expect(factorVida(10, 10), 1.0);
      expect(factorVida(5, 10), 1.5);
      expect(factorVida(1, 10), 2.5);
      expect(factorVida(0, 0), 2.5, reason: 'sin vidas no se rompe la cuenta');
    });

    test('los dos multiplicadores se combinan', () {
      expect(dificultadTotal(100, 4, 5, 10), closeTo(100 * 3.5 * 1.5, 0.001));
    });

    test('los números concretos del diseño', () {
      expect(enemigosDeOleada(50, 4), 125);
      expect(enemigosDeOleada(50, 1), 50);
      expect(velocidadProyectil(100, 4), closeTo(145, 0.001));
      expect(proyectilesExtra(4), 3);
      expect(proyectilesExtra(1), 0);
      expect(vidaDeJefe(1), 10000);
      expect(vidaDeJefe(4), 35000);
    });
  });

  group('La ruta del guerrero', () {
    Evaluacion evaluar({int destruidos = 0, int vidas = 0, bool insignia = false}) =>
        evaluarCondiciones(
          destruidos: destruidos,
          generados: 100,
          vidasPerdidas: vidas,
          insignia: insignia,
        );

    test('con dos de tres condiciones baja el jefe de verdad', () {
      expect(evaluar(destruidos: 90, vidas: 1).jefeVerdadero, isTrue);
      expect(evaluar(destruidos: 90, vidas: 0, insignia: true).perfecto, isTrue);
    });

    test('con una sola sale el sustituto', () {
      expect(evaluar(destruidos: 40, vidas: 3, insignia: true).jefeVerdadero, isFalse);
    });

    test('el 85% cuenta y el 84% no', () {
      expect(evaluar(destruidos: 85).condiciones[0].cumplida, isTrue);
      expect(evaluar(destruidos: 84).condiciones[0].cumplida, isFalse);
    });

    test('perder una vida cumple, perder dos no', () {
      expect(evaluar(vidas: 1).condiciones[1].cumplida, isTrue);
      expect(evaluar(vidas: 2).condiciones[1].cumplida, isFalse);
    });

    test('un stage sin enemigos no divide por cero', () {
      final ev = evaluarCondiciones(destruidos: 0, generados: 0, vidasPerdidas: 0, insignia: false);
      expect(ev.porcentaje, 0);
    });

    test('la ruta final sale de toda la campaña', () {
      const perfecta = [Evaluacion(condiciones: [], porcentaje: 1, cumplidas: 3)];
      const mediocre = [Evaluacion(condiciones: [], porcentaje: 1, cumplidas: 2)];
      const mala = [Evaluacion(condiciones: [], porcentaje: 1, cumplidas: 1)];

      expect(rutaFinal(desempenoGlobal(perfecta)), Ruta.gloria);
      expect(rutaFinal(desempenoGlobal(mediocre)), Ruta.guerrero);
      expect(rutaFinal(desempenoGlobal(mala)), Ruta.verguenza);
      expect(desempenoGlobal([]), 0);
    });
  });

  group('Puntuación', () {
    test('premia jugar bien, no jugar mucho', () {
      final limpio = puntuarStage(base: 10000, sinDanoEnJefe: true, sinMuertes: true);
      expect(limpio.total, 25000);
      expect(limpio.detalle, hasLength(2));

      final pelado = puntuarStage(base: 10000, sinDanoEnJefe: false, sinMuertes: false);
      expect(pelado.total, 10000);
    });

    test('un jefe vale más que un mid-boss', () {
      expect(Puntos.faseJefe, greaterThan(Puntos.midboss));
    });
  });

  group('Los datos están completos', () {
    test('hay más de veinte países, sin repetir', () {
      expect(paises.length, greaterThanOrEqualTo(20));
      expect(paises.map((p) => p.id).toSet(), hasLength(paises.length));
    });

    test('cada país tiene dos pilotos, arma y bomba que existen', () {
      final siluetas = siluetasDisponibles();
      const bombas = ['pantalla', 'barrido', 'escudo', 'columna', 'lluvia'];

      for (final pais in paises) {
        expect(pais.naves, hasLength(2), reason: pais.id);
        expect(tiposDeArma, contains(pais.arma.tipo), reason: pais.id);
        expect(bombas, contains(pais.bomba.tipo), reason: pais.id);
        expect(pais.colores, hasLength(3), reason: pais.id);
        expect(pais.arma.cadencia, lessThanOrEqualTo(0.5), reason: pais.id);

        for (final nave in pais.naves) {
          expect(siluetas, contains(nave.silueta), reason: '${pais.id}/${nave.nombre}');
          expect(nave.velocidad, inInclusiveRange(1, 5));
          expect(nave.poder, inInclusiveRange(1, 5));
          expect(nave.piloto, isNotEmpty);
        }
      }
    });

    test('todos los tipos de arma se usan al menos una vez', () {
      for (final tipo in tiposDeArma) {
        expect(paises.any((p) => p.arma.tipo == tipo), isTrue, reason: tipo);
      }
    });

    test('los escenarios no piden nada que no exista', () {
      const formaciones = ['fila', 'uve', 'lados', 'suelo', 'centro', 'aleatoria'];

      for (final stage in stages) {
        for (final entrada in stage.plantillas.entries) {
          expect(movimientosValidos, contains(entrada.value.movimiento), reason: entrada.key);
          final disparo = entrada.value.disparo;
          if (disparo != null) {
            expect(disparosValidos, contains(disparo.tipo), reason: entrada.key);
          }
        }

        for (final suceso in stage.guion) {
          if (suceso.tipo != 'oleada') continue;
          expect(stage.plantillas.containsKey(suceso.plantilla), isTrue, reason: suceso.plantilla);
          expect(formaciones, contains(suceso.formacion));
        }

        expect(stage.guion.any((s) => s.tipo == 'jefe'), isTrue, reason: stage.id);
      }
    });

    test('cada jefe reparte toda su vida entre sus fases', () {
      for (final jefe in [...stages.map((s) => s.jefe), jefeSustituto]) {
        final suma = jefe.fases.fold<double>(0, (t, f) => t + f.vida);
        expect(suma, closeTo(1, 0.0001), reason: jefe.nombre);

        for (final fase in jefe.fases) {
          expect(movimientosJefe, contains(fase.movimiento), reason: '${jefe.nombre}/${fase.nombre}');
          for (final ataque in fase.ataques) {
            expect(ataquesJefe, contains(ataque.tipo), reason: '${jefe.nombre}/${fase.nombre}');
          }
          if (fase.requierePartes) expect(fase.partes, isNotEmpty);
        }
      }

      expect(stages.every((s) => s.jefe.fases.length == 3), isTrue);
      expect(jefeSustituto.fases, hasLength(1));
      expect(jefeSustituto.escalaVida, lessThanOrEqualTo(0.5));
    });
  });

  group('Se juega de principio a fin', () {
    test('un escenario entero, con jefe de tres fases', () {
      final sim = _jugarStage(stages[0], 1, cumplirCondiciones: true);

      expect(sim.partida.estado, EstadoPartida.terminado);
      expect(sim.partida.jefeVerdadero, isTrue);
      expect(sim.fasesVistas, 3);
      expect(sim.partida.generados, greaterThan(20));
      expect(sim.partida.destruidos, greaterThan(0));
      expect(sim.partida.destruidos, lessThanOrEqualTo(sim.partida.generados));
      expect(sim.maxEnemigos, greaterThan(8), reason: 'la pantalla llegó a llenarse');
      expect(sim.partida.resultado, isNotNull);
    });

    test('los tres escenarios se pueden terminar', () {
      for (final stage in stages) {
        final sim = _jugarStage(stage, 1, cumplirCondiciones: true);
        expect(sim.partida.estado, EstadoPartida.terminado, reason: stage.titulo);
        expect(sim.fasesVistas, 3, reason: stage.titulo);
      }
    });

    test('con cuatro jugadores hay más de todo', () {
      final cuatro = _jugarStage(stages[1], 4, cumplirCondiciones: true);
      final uno = _jugarStage(stages[1], 1, cumplirCondiciones: true);

      expect(cuatro.partida.estado, EstadoPartida.terminado);
      expect(cuatro.partida.vidasIniciales, 10);
      expect(cuatro.partida.jefe!.vidaTotal, 35000);
      expect(cuatro.partida.generados, greaterThan(uno.partida.generados));
      expect(cuatro.maxBalas, greaterThan(30));
    });

    test('jugar del montón no basta: sale el mono', () {
      final sim = _jugarStage(stages[0], 1);

      expect(sim.partida.jefeVerdadero, isFalse);
      expect(sim.partida.jefe!.nombre, 'Osaru');
      expect(sim.partida.jefe!.def.fases, hasLength(1));
      expect(sim.partida.destruidos / sim.partida.generados, lessThan(0.85));
    });
  });

  group('Morir cuesta vidas del bote común', () {
    test('se descuenta una por muerte y se acaba al llegar a cero', () {
      final partida = Partida(stage: stages[0], alineaciones: _alineaciones(2), semilla: 7);
      final [a, b] = partida.jugadores;

      expect(partida.vidas, 5);

      a.invulnerable = 0;
      partida.matarJugador(a);
      expect(partida.vidas, 4);
      expect(a.viva, isFalse);
      expect(partida.vidasPerdidas, 1);

      partida.matarJugador(a);
      expect(partida.vidas, 4, reason: 'un caído no vuelve a morir');

      b.viva = false;
      partida.vidas = 0;
      partida.actualizar(paso, Mandos());
      expect(partida.estado, EstadoPartida.gameOver);
    });
  });

  group('Insignias', () {
    test('las campanas, en orden y sin tocar edificios', () {
      final buena = Partida(stage: stages[0], alineaciones: _alineaciones(1), semilla: 7);
      for (var orden = 0; orden < 4; orden++) {
        buena.anotarDerribo('campana', orden, 0, 0);
      }
      expect(buena.insignia, isTrue);

      final conEdificio = Partida(stage: stages[0], alineaciones: _alineaciones(1), semilla: 7);
      conEdificio.anotarDerribo('edificio', 0, 0, 0);
      for (var orden = 0; orden < 4; orden++) {
        conEdificio.anotarDerribo('campana', orden, 0, 0);
      }
      expect(conEdificio.insignia, isFalse);

      final desordenada = Partida(stage: stages[0], alineaciones: _alineaciones(1), semilla: 7);
      for (final orden in [1, 0, 2, 3]) {
        desordenada.anotarDerribo('campana', orden, 0, 0);
      }
      expect(desordenada.insignia, isFalse);
    });

    test('exactamente siete icebergs', () {
      Partida conIcebergs(int cuantos) {
        final partida = Partida(stage: stages[2], alineaciones: _alineaciones(2), semilla: 7);
        for (var i = 0; i < cuantos; i++) {
          partida.anotarDerribo('iceberg', 0, 0, 0);
        }
        return partida..cerrarInsignias();
      }

      expect(conIcebergs(7).insignia, isTrue);
      expect(conIcebergs(8).insignia, isFalse);
      expect(conIcebergs(6).insignia, isFalse);
    });
  });

  group('Mecánicas cooperativas', () {
    test('tres jugadores sobre el mismo enemigo hacen ×2.5', () {
      final partida = Partida(stage: stages[0], alineaciones: _alineaciones(3), semilla: 7);
      final enemigo = Enemigo(stages[0].plantillas['quetzalcoatl']!, 240, 100, partida);

      final antes = enemigo.vida;
      enemigo.golpear(100, 0, partida);
      enemigo.golpear(100, 1, partida);
      final conDos = antes - enemigo.vida;
      enemigo.golpear(100, 2, partida);
      final alTercero = antes - enemigo.vida - conDos;

      expect(conDos, 200);
      expect(alTercero, 250);
      expect(partida.combinadoActivo, greaterThan(0));
    });

    test('dos jugadores juntos y disparando levantan escudo', () {
      final partida = Partida(stage: stages[0], alineaciones: _alineaciones(2), semilla: 7);
      final [a, b] = partida.jugadores;

      // El disparo tiene que venir del mando: cada paso lo vuelve a leer, así
      // que ponerlo a mano en el jugador no sobrevive a `actualizar`.
      final mandos = Mandos()
        ..aplicar(0, const EstadoMando(disparo: true))
        ..aplicar(1, const EstadoMando(disparo: true));

      a
        ..x = 200
        ..y = 400;
      b
        ..x = 240
        ..y = 400;

      partida.actualizar(paso, mandos);
      expect(partida.escudos, hasLength(1));

      // Contra el escudo que ha salido, no contra donde se supone que está: si
      // el escenario empuja a los jugadores, la barrera se va con ellos.
      final escudo = partida.escudos.first;
      final medioX = (escudo.x1 + escudo.x2) / 2;
      final medioY = (escudo.y1 + escudo.y2) / 2;
      expect(partida.chocaConEscudo(medioX, medioY, 4), isTrue);
      expect(partida.chocaConEscudo(medioX, medioY - 100, 4), isFalse);

      // Y en cuanto uno suelta el disparo, la barrera cae.
      mandos.aplicar(1, const EstadoMando());
      partida.actualizar(paso, mandos);
      expect(partida.escudos, isEmpty);
    });

    test('donar cambia potencia por una vida del bote', () {
      final partida = Partida(stage: stages[0], alineaciones: _alineaciones(2), semilla: 7);
      final jugador = partida.jugadores.first;

      partida.vidas = 3;
      jugador.nivel = 3;
      partida.donarVida(jugador);
      expect(partida.vidas, 4);
      expect(jugador.nivel, 2);

      jugador.nivel = 1;
      partida.donarVida(jugador);
      expect(partida.vidas, 4, reason: 'sin potencia que dar, no se dona');
    });

    test('tres bombas a la vez se funden en el Armagedón', () {
      final partida = Partida(stage: stages[0], alineaciones: _alineaciones(3), semilla: 7);
      for (final jugador in partida.jugadores) {
        jugador.bombas = 2;
        partida.lanzarBomba(jugador);
      }
      expect(partida.bombas.any((b) => b.conjunta), isTrue);
    });
  });
}
