export function generateTimelineData(points = 60) {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(now - (points - i) * 30000).toLocaleTimeString("en-US", {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    }),
    cpu: 25 + Math.random() * 40 + Math.sin(i / 5) * 10,
    memory: 35 + Math.random() * 15 + Math.cos(i / 8) * 5,
    netIn: Math.random() * 50,
    netOut: Math.random() * 30,
  }));
}

export function generateSparkline(points = 20, base = 30, variance = 20) {
  return Array.from(
    { length: points },
    (_, i) => base + Math.random() * variance + Math.sin(i / 3) * (variance / 3)
  );
}

export function generateCostData(days = 30) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      anthropic: 12 + Math.random() * 15,
      openai: 3 + Math.random() * 6,
      openrouter: 1 + Math.random() * 3,
    });
  }
  return data;
}
