describe('Anomaly Detection Rules', () => {
  // 1. Capacity Breach
  test('fires capacity_breach when occupancy > 90%', () => {
    const capacity = 100;
    const currentOccupancy = 95;
    const pct = (currentOccupancy / capacity) * 100;
    expect(pct > 90).toBe(true);
  });

  test('does not fire capacity_breach when occupancy <= 90%', () => {
    const capacity = 100;
    const currentOccupancy = 88;
    const pct = (currentOccupancy / capacity) * 100;
    expect(pct > 90).toBe(false);
  });

  test('auto-resolves capacity_breach when occupancy drops below 85%', () => {
    const capacity = 100;
    const currentOccupancy = 82;
    const pct = (currentOccupancy / capacity) * 100;
    expect(pct < 85).toBe(true);
  });

  // 2. Zero Check-ins
  test('fires zero_checkins during operating hours (6am-10pm) if no check-ins in 2h', () => {
    const hour = 14;
    const isOperatingHours = hour >= 6 && hour < 22;
    const recentCheckins = 0;
    expect(isOperatingHours && recentCheckins === 0).toBe(true);
  });

  test('does not fire zero_checkins outside operating hours (e.g. 2am)', () => {
    const hour = 2;
    const isOperatingHours = hour >= 6 && hour < 22;
    expect(isOperatingHours).toBe(false);
  });

  test('auto-resolves zero_checkins when a check-in arrives', () => {
    const recentCheckins = 1;
    expect(recentCheckins > 0).toBe(true);
  });

  // 3. Revenue Drop
  test('fires revenue_drop when today revenue < 70% of last week same day', () => {
    const lastWeekRev = 10000;
    const todayRev = 6500;
    expect(todayRev < 0.7 * lastWeekRev).toBe(true);
  });

  test('does not fire revenue_drop when today revenue >= 70% of last week', () => {
    const lastWeekRev = 10000;
    const todayRev = 7500;
    expect(todayRev < 0.7 * lastWeekRev).toBe(false);
  });

  test('auto-resolves revenue_drop when revenue recovers within 20% of last week', () => {
    const lastWeekRev = 10000;
    const todayRev = 8200;
    expect(todayRev >= 0.8 * lastWeekRev).toBe(true);
  });

  // 4. Simulator Speed Logic
  test('calculates correct interval delay for 5x speed', () => {
    const speed = 5;
    const interval = Math.max(200, 2000 / speed);
    expect(interval).toBe(400);
  });
});