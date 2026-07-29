/// Cómo dispara cada tipo de arma.
///
/// Un país no trae código: trae el *tipo* de su arma y sus números. Estas diez
/// funciones cubren las veintiuna armas del diseño, y las diferencias entre dos
/// países que comparten tipo (color, cadencia, daño, alcance) bastan para que
/// en las manos se noten distintas.
library;

import 'dart:math' as math;

import '../datos/paises.dart';
import 'balas.dart';

/// Cuántos cañones escupe cada nivel de potencia.
const Map<int, int> _canones = {1: 2, 2: 3, 3: 4, 4: 6};

final _azar = math.Random();

/// Lo que necesita un arma para disparar: dónde está la nave y cómo de fuerte.
class Tirador {
  const Tirador({
    required this.x,
    required this.y,
    required this.nivel,
    required this.poder,
    required this.indice,
  });

  final double x;
  final double y;
  final int nivel;
  final int poder;
  final int indice;

  /// El daño sube con el nivel de potencia y con la estadística de la nave.
  double dano(double base) => base * (1 + (nivel - 1) * 0.18) * (0.85 + poder * 0.05);
}

/// El azar es el de la partida que dispara, para que una partida con semilla
/// salga igual dos veces. Sin él, el enjambre sortea por su cuenta.
List<Bala> dispararArma(Tirador t, Arma arma, {math.Random? azar}) {
  return switch (arma.tipo) {
    'abanico' => _abanico(t, arma),
    'guiado' => _guiado(t, arma),
    'plasma' => _plasma(t, arma),
    'penetrante' => _penetrante(t, arma),
    'rayo' => _rayo(t, arma),
    'rebote' => _rebote(t, arma),
    'onda' => _onda(t, arma),
    'enjambre' => _enjambre(t, arma, azar ?? _azar),
    'fragmenta' => _fragmenta(t, arma),
    _ => _recto(t, arma),
  };
}

/// Lo clásico: cañones paralelos hacia arriba.
List<Bala> _recto(Tirador t, Arma arma) {
  final n = _canones[t.nivel]!;
  return List.generate(n, (i) {
    final separacion = (i - (n - 1) / 2) * 9;
    return Bala(
      x: t.x + separacion,
      y: t.y - 14,
      vx: 0,
      vy: -620,
      radio: 3.5,
      color: arma.color,
      dano: t.dano(arma.dano),
      duenno: t.indice,
      efecto: arma.efecto,
    );
  });
}

/// Abanico: cubre mucho ancho, pero reparte el daño.
List<Bala> _abanico(Tirador t, Arma arma) {
  final n = 1 + t.nivel * 2;
  final apertura = arma.apertura ?? 0.4;
  return List.generate(n, (i) {
    final angulo = -math.pi / 2 + (i - (n - 1) / 2) * (apertura / n) * 2;
    return Bala(
      x: t.x,
      y: t.y - 12,
      vx: math.cos(angulo) * 540,
      vy: math.sin(angulo) * 540,
      radio: 3.5,
      color: arma.color,
      dano: t.dano(arma.dano),
      duenno: t.indice,
    );
  });
}

/// Misiles que buscan solos: poco daño por unidad, pero no fallan.
List<Bala> _guiado(Tirador t, Arma arma) {
  final n = math.min(4, 1 + (t.nivel / 1.2).floor());
  return List.generate(n, (i) {
    final lado = i.isEven ? -1 : 1;
    return Bala(
      x: t.x + lado * (10 + (i ~/ 2) * 8),
      y: t.y,
      vx: lado * 90.0,
      vy: -400,
      radio: 4,
      color: arma.color,
      forma: 'misil',
      guia: arma.giro ?? 5.5,
      dano: t.dano(arma.dano),
      duenno: t.indice,
    );
  });
}

/// Bola gorda y lenta que se apaga a media pantalla.
List<Bala> _plasma(Tirador t, Arma arma) {
  final alcance = arma.alcance ?? 260;
  final balas = [
    Bala(
      x: t.x,
      y: t.y - 12,
      vx: 0,
      vy: -430,
      radio: 6 + t.nivel * 1.6,
      color: arma.color,
      forma: 'plasma',
      alcance: alcance,
      dano: t.dano(arma.dano),
      duenno: t.indice,
      penetra: true, // atraviesa la fila entera mientras le quede alcance
    ),
  ];

  if (t.nivel >= 3) {
    for (final lado in [-1, 1]) {
      balas.add(Bala(
        x: t.x + lado * 16,
        y: t.y - 4,
        vx: lado * 70.0,
        vy: -420,
        radio: 4 + t.nivel.toDouble(),
        color: arma.color,
        forma: 'plasma',
        alcance: alcance * 0.8,
        dano: t.dano(arma.dano) * 0.5,
        duenno: t.indice,
        penetra: true,
      ));
    }
  }
  return balas;
}

/// Lanza que atraviesa todo lo que se le ponga delante.
List<Bala> _penetrante(Tirador t, Arma arma) {
  final n = t.nivel >= 3 ? 2 : 1;
  return List.generate(n, (i) {
    final separacion = (i - (n - 1) / 2) * 18;
    return Bala(
      x: t.x + separacion,
      y: t.y - 18,
      vx: 0,
      vy: -780,
      radio: 5 + t.nivel.toDouble(),
      color: arma.color,
      forma: 'lanza',
      penetra: true,
      dano: t.dano(arma.dano),
      duenno: t.indice,
      efecto: arma.efecto,
    );
  });
}

/// Rayo continuo.
///
/// No es un haz de verdad sino balas muy seguidas y muy rápidas que atraviesan:
/// se ve igual, se siente igual y no obliga a inventar un tipo de colisión
/// aparte para una sola arma.
List<Bala> _rayo(Tirador t, Arma arma) {
  final n = t.nivel >= 4 ? 2 : 1;
  return List.generate(n, (i) {
    final separacion = (i - (n - 1) / 2) * 14;
    return Bala(
      x: t.x + separacion,
      y: t.y - 20,
      vx: 0,
      vy: -1100,
      radio: 4 + t.nivel * 0.8,
      color: arma.color,
      forma: 'rayo',
      penetra: true,
      dano: t.dano(arma.dano),
      duenno: t.indice,
    );
  });
}

/// Discos que rebotan en las paredes: castigan a quien se pega a los bordes.
List<Bala> _rebote(Tirador t, Arma arma) {
  final n = math.min(3, t.nivel);
  return List.generate(n, (i) {
    final angulo = -math.pi / 2 + (i - (n - 1) / 2) * 0.55;
    return Bala(
      x: t.x,
      y: t.y - 12,
      vx: math.cos(angulo) * 480,
      vy: math.sin(angulo) * 480,
      radio: 7,
      color: arma.color,
      forma: 'disco',
      rebotes: 3,
      dano: t.dano(arma.dano),
      duenno: t.indice,
    );
  });
}

/// Balas que bailan en sentidos opuestos.
List<Bala> _onda(Tirador t, Arma arma) {
  final n = _canones[t.nivel]!;
  return List.generate(n, (i) {
    final fase = i.isEven ? 1 : -1;
    return Bala(
      x: t.x + (i - (n - 1) / 2) * 6,
      y: t.y - 12,
      vx: 0,
      vy: -560,
      radio: 4,
      color: arma.color,
      dano: t.dano(arma.dano),
      duenno: t.indice,
      amplitud: (arma.amplitud ?? 34) * fase,
      frecuencia: 9,
      efecto: arma.efecto,
    );
  });
}

/// Muchos cohetes pequeños, sin puntería fina.
List<Bala> _enjambre(Tirador t, Arma arma, math.Random azar) {
  final n = 2 + t.nivel;
  final dispersion = arma.dispersion ?? 0.25;
  return List.generate(n, (_) {
    final angulo = -math.pi / 2 + (azar.nextDouble() - 0.5) * dispersion * 2;
    return Bala(
      x: t.x + (azar.nextDouble() - 0.5) * 18,
      y: t.y - 10,
      vx: math.cos(angulo) * 620,
      vy: math.sin(angulo) * 620,
      radio: 3,
      color: arma.color,
      forma: 'misil',
      dano: t.dano(arma.dano),
      duenno: t.indice,
    );
  });
}

/// Torpedo que al reventar suelta esquirlas en todas direcciones.
List<Bala> _fragmenta(Tirador t, Arma arma) {
  return [
    Bala(
      x: t.x,
      y: t.y - 14,
      vx: 0,
      vy: -500,
      radio: 6,
      color: arma.color,
      forma: 'misil',
      dano: t.dano(arma.dano),
      duenno: t.indice,
      esquirlas: (arma.esquirlas ?? 6) + t.nivel,
    ),
  ];
}

/// Las esquirlas que salen cuando revienta un proyectil de fragmentación.
List<Bala> esquirlasDe(Bala bala) {
  final total = bala.esquirlas;
  return List.generate(total, (i) {
    final angulo = (i / total) * math.pi * 2;
    return Bala(
      x: bala.x,
      y: bala.y,
      vx: math.cos(angulo) * 300,
      vy: math.sin(angulo) * 300,
      radio: 3,
      color: bala.color,
      dano: bala.dano * 0.35,
      duenno: bala.duenno,
      alcance: 90,
    );
  });
}

/// Los tipos que existen, para que las pruebas comprueben que ningún país pide
/// un arma que nadie sabe disparar.
const List<String> tiposDeArma = [
  'recto', 'abanico', 'guiado', 'plasma', 'penetrante',
  'rayo', 'rebote', 'onda', 'enjambre', 'fragmenta',
];
