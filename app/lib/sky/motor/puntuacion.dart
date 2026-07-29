/// Puntos y bonificaciones.
///
/// Los dos bonos grandes premian jugar bien, no jugar mucho: acabar con el jefe
/// sin recibir un rasguño y que no caiga nadie del equipo.
library;

class Puntos {
  const Puntos._();

  static const int basico = 150;
  static const int medio = 1200;
  static const int pesado = 3000;
  static const int midboss = 10000;
  static const int faseJefe = 25000;
  static const int insignia = 20000;
  static const int moneda = 500;
}

class Bonificacion {
  const Bonificacion(this.concepto, this.puntos);

  final String concepto;
  final int puntos;
}

class CierreDeStage {
  const CierreDeStage(this.total, this.detalle);

  final int total;
  final List<Bonificacion> detalle;
}

CierreDeStage puntuarStage({
  required int base,
  required bool sinDanoEnJefe,
  required bool sinMuertes,
  bool naveDeTuPais = false,
}) {
  var total = base;
  final detalle = <Bonificacion>[];

  if (sinDanoEnJefe) {
    final bono = (base * 0.5).round();
    total += bono;
    detalle.add(Bonificacion('Precisión: jefe sin recibir daño', bono));
  }
  if (sinMuertes) {
    total += base;
    detalle.add(Bonificacion('Equipo intacto: nadie cayó', base));
  }
  if (naveDeTuPais) {
    final bono = (base * 0.25).round();
    total += bono;
    detalle.add(Bonificacion('Vuelas la bandera de tu país', bono));
  }

  return CierreDeStage(total, detalle);
}
