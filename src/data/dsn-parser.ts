export interface DsnTarget {
  name: string;
  id: string;
  uplegRange: number;
  downlegRange: number;
  rtlt: number;
}

export interface DsnDish {
  name: string;
  azimuth: number;
  elevation: number;
  targets: DsnTarget[];
}

export interface DsnStation {
  name: string;
  friendly: string;
  dishes: DsnDish[];
}

export function parseDSN(xmlText: string): DsnStation[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const stations: DsnStation[] = [];

  const stationEls = doc.querySelectorAll('station');
  for (const stationEl of stationEls) {
    const station: DsnStation = {
      name: stationEl.getAttribute('name') || '',
      friendly: stationEl.getAttribute('friendlyName') || stationEl.getAttribute('friendly') || '',
      dishes: [],
    };

    const dishEls = stationEl.querySelectorAll('dish');
    for (const dishEl of dishEls) {
      const dish: DsnDish = {
        name: dishEl.getAttribute('name') || '',
        azimuth: parseFloat(dishEl.getAttribute('azimuthAngle') || '0'),
        elevation: parseFloat(dishEl.getAttribute('elevationAngle') || '0'),
        targets: [],
      };

      const targetEls = dishEl.querySelectorAll('downSignal, target');
      for (const targetEl of targetEls) {
        const name = targetEl.getAttribute('spacecraft') || targetEl.getAttribute('name') || '';
        dish.targets.push({
          name,
          id: targetEl.getAttribute('spacecraftId') || targetEl.getAttribute('id') || '',
          uplegRange: parseFloat(targetEl.getAttribute('uplegRange') || '0'),
          downlegRange: parseFloat(targetEl.getAttribute('downlegRange') || '0'),
          rtlt: parseFloat(targetEl.getAttribute('rtlt') || '0'),
        });
      }

      station.dishes.push(dish);
    }

    stations.push(station);
  }

  return stations;
}

export function findOrionTarget(stations: DsnStation[]): {
  station: DsnStation;
  dish: DsnDish;
  target: DsnTarget;
} | null {
  for (const station of stations) {
    for (const dish of station.dishes) {
      for (const target of dish.targets) {
        const name = target.name.toUpperCase();
        if (name.includes('ORION') || name.includes('ARTEMIS') || name.includes('EM2') || name.includes('EM-2')) {
          return { station, dish, target };
        }
      }
    }
  }
  return null;
}
