export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Schön, dass du vorbeischaust";
  if (hour < 21) return "Guten Abend";
  return "Noch ein kleiner Anker";
}
