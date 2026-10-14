interface Oferta {
  clave: string;
  nombreMateria: string;
  grupo: string;
  profesor: string;
  salon: string;
  sesiones: Sesion[];
}
interface Sesion {
  dia: Dia;
  inicio: number;
  fin: number;
}
const DIAS = {
  LUNES: 0,
  MARTES: 1,
  MIERCOLES: 2,
  JUEVES: 3,
  VIERNES: 4,
  SABADO: 5,
} as const;

type Dia = (typeof DIAS)[keyof typeof DIAS];

const COSTOS = {
  HORA_HUECO: 3,
} as const;

function choca(ofertaA: Oferta, ofertaB: Oferta) {
  for (const sesionA of ofertaA.sesiones)
    for (const sesionB of ofertaB.sesiones) {
      if (sesionA.dia !== sesionB.dia) continue; //no son el mismo dia=> skipeamos

      if (!(sesionA.fin <= sesionB.inicio || sesionB.fin <= sesionA.inicio)) {
        return true; //sí chocan
      }
    }
  return false; //no chocan
}

function puedeAgregar(nuevaOferta: Oferta, horarioTemp: Oferta[]) {
  for (const oferta of horarioTemp) {
    if (choca(nuevaOferta, oferta)) {
      return false;
    }
  }
  return true;
}
function calcularHorasHuecos(horario: Oferta[], diasIgnorados: Dia[]) {
  const sesiones = horario.flatMap((oferta) => oferta.sesiones);
  sesiones.sort((sesionA: Sesion, sesionB: Sesion) => {
    if (sesionA.dia !== sesionB.dia) {
      return sesionA.dia - sesionB.dia;
    }
    return sesionA.inicio - sesionB.inicio;
  });
  let huecosMin = 0;
  for (let i = 0; i < sesiones.length - 1; i++) {
    const actual = sesiones[i];
    const siguiente = sesiones[i + 1];

    if (actual.dia !== siguiente.dia) continue;

    if (diasIgnorados.includes(actual.dia)) continue;

    huecosMin += siguiente.inicio - actual.fin;
  }
  return huecosMin / 60;
}
function calcularCosto(horario: Oferta[]) {
  let costoTotal = 0;

  costoTotal += calcularHorasHuecos(horario, [DIAS.LUNES]) * COSTOS.HORA_HUECO;
  // costoTotal += algun otro costo ns aun

  return costoTotal;
}
function buscarHorario(materia: number, horarioTemp: Oferta[]) {
  // if (materia===materias.length){ aqui hacemos el score y guardamos en horarios} CONDICION BASE
  for (const oferta of ofertas[materia]) {
    //recorremos todas las ofertas que tiene esta materia

    if (!puedeAgregar(oferta, horarioTemp)) continue;

    horarioTemp.push(oferta);

    buscarHorario(materia + 1, horarioTemp);

    horarioTemp.pop();
  }
}
