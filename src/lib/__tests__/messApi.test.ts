/// <reference types="jest" />
import { addDays, todayKey } from '../dates';

// In-memory stand-in for the SQLite settings table.
const mockStore = new Map<string, string>();
jest.mock('../db', () => ({
  getSetting: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setSetting: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
  deleteSettingsBefore: jest.fn(async () => {}),
}));

// eslint-disable-next-line import/first
import { fetchBoughtExtras, fetchMenusForDate, fetchRegistration, testDiningKey } from '../messApi';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const status = (code: number) => ({ ok: false, status: code, json: async () => ({ error: { code: 'x' } }) });

const weekday = (key: string) =>
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8))).getDay()
  ];

const menuBody = (key: string) => ({
  data: [{ mess: 'kadamba-nonveg', days: { [weekday(key)]: { lunch: [{ item: 'Dal makhni', category: 'Dal' }] } } }],
});

let fetchMock: jest.Mock;
beforeEach(() => {
  mockStore.clear();
  fetchMock = jest.fn();
  (globalThis as any).fetch = fetchMock;
});

describe('fetchMenusForDate', () => {
  it('fetches, extracts and caches the day', async () => {
    const today = todayKey();
    fetchMock.mockResolvedValueOnce(ok(menuBody(today)));
    const first = await fetchMenusForDate(today);
    expect(first?.menus.kadamba?.lunch?.[0].item).toBe('Dal makhni');
    expect(fetchMock.mock.calls[0][0]).toBe(`https://dining.iiit.ac.in/api/mess/menus?on=${today}`);
    // Second call is served from the fresh cache.
    const second = await fetchMenusForDate(today);
    expect(second?.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('saves the whole week from one request', async () => {
    const today = todayKey();
    const weekBody = {
      data: [
        {
          mess: 'kadamba-nonveg',
          days: Object.fromEntries(
            ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => [
              d,
              { lunch: [{ item: `${d} dal`, category: 'Dal' }] },
            ]),
          ),
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(ok(weekBody));
    await fetchMenusForDate(today);
    const saved = [...mockStore.keys()].filter((k) => k.startsWith('mess:menu:'));
    expect(saved).toHaveLength(7);
    // Another day of the same week is answered from the saved copy, no request.
    const other = saved.find((k) => k !== `mess:menu:${today}`)!.slice('mess:menu:'.length);
    const res = await fetchMenusForDate(other);
    expect(res?.menus.kadamba?.lunch?.[0].item).toBe(`${weekday(other)} dal`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refresh skips the saved copy, and keeps it if the portal is unreachable', async () => {
    const today = todayKey();
    fetchMock.mockResolvedValueOnce(ok(menuBody(today)));
    const first = await fetchMenusForDate(today);
    fetchMock.mockRejectedValueOnce(new Error('VPN off'));
    const refreshed = await fetchMenusForDate(today, { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed?.fromCache).toBe(true);
    expect(refreshed?.savedAt).toBe(first?.savedAt);
    expect(refreshed?.menus.kadamba?.lunch?.[0].item).toBe('Dal makhni');
  });

  it('falls back to a stale saved copy when offline', async () => {
    const today = todayKey();
    mockStore.set(
      `mess:menu:${today}`,
      JSON.stringify({ fetchedAt: Date.now() - 24 * 3600e3, value: { kadamba: { lunch: [{ item: 'Saved dal', category: 'Dal' }] } } }),
    );
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const res = await fetchMenusForDate(today);
    expect(res?.fromCache).toBe(true);
    expect(res?.menus.kadamba?.lunch?.[0].item).toBe('Saved dal');
  });

  it('returns null when offline with nothing saved', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchMenusForDate(addDays(todayKey(), -3))).toBeNull();
  });
});

describe('fetchRegistration', () => {
  it('needs a key and sends it as a raw Authorization header', async () => {
    expect(await fetchRegistration(todayKey(), null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(ok({ data: { lunch: { meal_mess: 'kadamba-veg', cancelled_at: null, availed_at: null } } }));
    const reg = await fetchRegistration(todayKey(), 'test-key');
    expect(reg?.lunch?.mess).toBe('kadamba');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'test-key' });
  });

  it('reports a rejected key', async () => {
    fetchMock.mockResolvedValueOnce(status(401));
    await expect(fetchRegistration(todayKey(), 'bad')).rejects.toThrow(/rejected/);
    fetchMock.mockResolvedValueOnce(status(401));
    expect(await testDiningKey('bad')).toEqual({ ok: false, message: 'Key rejected by the dining portal' });
  });
});

describe('fetchBoughtExtras', () => {
  it('lists bought extras and ignores cancelled ones', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ data: [{ extra_name: '2 Egg Omelette', cancelled_at: null }, { extra_name: 'Juice', cancelled_at: '2026-10-21' }] }),
    );
    expect(await fetchBoughtExtras(todayKey(), 'breakfast', 'k')).toEqual(['2 Egg Omelette']);
  });

  it('never throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchBoughtExtras(todayKey(), 'lunch', 'k')).toEqual([]);
    expect(await fetchBoughtExtras(todayKey(), 'lunch', null)).toEqual([]);
  });
});
