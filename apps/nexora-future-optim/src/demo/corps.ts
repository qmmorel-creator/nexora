// Sport, santé et photos FICTIFS de démonstration (Ref #660). Mêmes FORMES
// de réponse que les routes de nexora-project (sport-activities,
// health-records, body-photos) ; données générées, démo seulement.
import type { AccesCorps } from "../donnees/source";
import { ErreurCorps } from "../donnees/source";
import { decalerJour } from "../donnees/sport";

const SPORTS: [string, number, number][] = [["Course à pied", 0.32, 48], ["Vélo", 0.2, 95], ["Musculation", 0.18, 55], ["Randonnée", 0.05, 190]];

export function corpsDemo(aujourdhui: string): AccesCorps {
  let g = 42; const a = () => (g = (g * 16807) % 2147483647) / 2147483647;
  const activities = [] as Record<string, unknown>[];
  for (let i = 420; i >= 0; i--) {
    const date = decalerJour(aujourdhui, -i);
    SPORTS.forEach(([sport, p, duree], k) => {
      if (a() > p) return;
      const total = Math.round(duree * (0.7 + a() * 0.6));
      const distance = sport === "Musculation" ? null : Math.round((sport === "Vélo" ? total * 0.42 : sport === "Course à pied" ? total / 5.6 : total / 14) * 10) / 10;
      activities.push({ id: `demo|${date}|${k}`, date, sport, title: `${sport} ${total} min`, total, moving: Math.round(total * 0.92), distance, elevation: distance ? Math.round(distance * (sport === "Randonnée" ? 60 : 8)) : null, hr: 120 + Math.round(a() * 35), maxHr: 160 + Math.round(a() * 25), url: null, start: `${date}T18:00:00`, end: "", eventId: "", calendarId: "", extra: {} });
    });
  }
  const records = [] as Record<string, unknown>[];
  for (let i = 200; i >= 0; i--) {
    if (a() < 0.08) continue;
    const t = i / 200;
    records.push({
      date: decalerJour(aujourdhui, -i), weight: Math.round((81.5 - (1 - t) * 3.2 + (a() - 0.5) * 0.8) * 10) / 10, bodyFat: Math.round((21 - (1 - t) * 2.5 + (a() - 0.5)) * 10) / 10,
      recovery: Math.round(45 + a() * 50), respRate: Math.round((14.2 + a() * 1.4) * 10) / 10, spo2: Math.round((95.6 + a() * 1.8) * 10) / 10, sleepHours: Math.round((6 + a() * 2.4) * 10) / 10, hrv: Math.round(38 + a() * 40), restingHr: Math.round(52 + a() * 9), strain: Math.round((6 + a() * 12) * 10) / 10, steps: Math.round(5000 + a() * 9000),
    });
  }
  // Photos : une silhouette dessinée, la seconde décalée et agrandie pour que l'alignement serve.
  const photos = [
    { id: "demo-photo-avril", status: "ready", date: decalerJour(aujourdhui, -180), dateSource: "exif", width: 600, height: 900, createdAt: "1", landmarks: { leftEye: { x: 270 / 600, y: 150 / 900 }, rightEye: { x: 330 / 600, y: 150 / 900 }, navel: { x: 300 / 600, y: 470 / 900 } }, adjust: {} },
    { id: "demo-photo-juillet", status: "ready", date: decalerJour(aujourdhui, -90), dateSource: "exif", width: 600, height: 900, createdAt: "2", landmarks: { leftEye: { x: 290 / 600, y: 170 / 900 }, rightEye: { x: 353 / 600, y: 170 / 900 }, navel: { x: 321.5 / 600, y: 506 / 900 } }, adjust: {} },
    { id: "demo-photo-octobre", status: "ready", date: decalerJour(aujourdhui, -2), dateSource: "import", width: 600, height: 900, createdAt: "3", landmarks: { leftEye: { x: 255 / 600, y: 140 / 900 }, rightEye: { x: 321 / 600, y: 140 / 900 }, navel: { x: 288 / 600, y: 492 / 900 } }, adjust: {} },
  ];
  const silhouette = (dx: number, dy: number, k: number, ventre: number, teinte: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="${teinte}"/><g transform="translate(${dx} ${dy}) translate(300 150) scale(${k}) translate(-300 -150)" fill="#c99c7f" stroke="#8d6a55" stroke-width="3"><circle cx="300" cy="150" r="62"/><circle cx="270" cy="150" r="6" fill="#3a2a22"/><circle cx="330" cy="150" r="6" fill="#3a2a22"/><path d="M230 240 Q300 215 370 240 L${395 + ventre} 470 Q300 ${520 + ventre} ${205 - ventre} 470 Z"/><circle cx="300" cy="470" r="5" fill="#8d6a55"/><path d="M215 250 L150 470 L175 480 L245 300 Z"/><path d="M385 250 L450 470 L425 480 L355 300 Z"/><path d="M240 480 L230 820 L285 820 L300 560 L315 820 L370 820 L360 480 Z"/></g></svg>`;
  const images: Record<string, string> = {
    "demo-photo-avril": silhouette(0, 0, 1, 30, "#e7e3dc"),
    "demo-photo-juillet": silhouette(21.5, 20, 1.05, 18, "#e2e6e9"),
    "demo-photo-octobre": silhouette(-12, -10, 1.1, 4, "#e9e4e7"),
  };
  return {
    async lire(ressource) {
      await new Promise((r) => setTimeout(r, 40));
      if (ressource === "sport-activities") return { activities, readAt: new Date().toISOString() };
      if (ressource === "health-records") return { records, readAt: new Date().toISOString() };
      if (ressource === "body-photos") return { photos, referenceId: "demo-photo-avril", maxBytes: 5 * 1024 * 1024 };
      throw new ErreurCorps("not_found");
    },
    async image(id) {
      const svg = images[id];
      if (!svg) throw new ErreurCorps("body_photo_not_found");
      return new Blob([svg], { type: "image/svg+xml" });
    },
  };
}
