/// <reference types="jest" />
import { buildHandoffPrompt, looksLikeHandoffReply } from '../handoff';
import { localUserText } from '../local/localPrompt';
import {
  buildMessContext,
  extractDayMenus,
  formatMessMenu,
  mealForSlot,
  MESSES,
  messGroupFor,
  parseRegistration,
  weekdayFor,
} from '../mess';
import { describeContext, type DayContext } from '../prompt';

// Trimmed from a real /api/mess/menus response (2026-10-21 is a Wednesday).
const menusResponse = {
  data: [
    {
      mess: 'kadamba-veg',
      days: { wednesday: { lunch: [{ item: 'Veg only dal', category: 'Dal' }] } },
    },
    {
      mess: 'kadamba-nonveg',
      days: {
        wednesday: {
          lunch: [
            { item: 'Live wheat roti', category: 'Phulka/Chapathi' },
            { item: 'Dal makhni', category: 'Dal' },
            { item: '', category: 'Veg Wet' },
            { item: 'Chicken curry', category: 'Non-Veg' },
          ],
          snacks: [{ item: 'Samosa', category: 'Snack' }],
          dinner: [{ item: 'Jeera rice', category: 'Flavoured Rice' }],
        },
        thursday: { lunch: [{ item: 'Not today', category: 'Dal' }] },
      },
    },
    {
      mess: 'bakul-nonveg',
      days: { wednesday: { dinner: [{ item: 'Egg curry', category: 'Non-Veg' }], lunch: [{ item: '', category: 'Sweet' }] } },
    },
    { mess: 'yuktahar', days: { wednesday: { breakfast: [{ item: 'Ragi malt', category: 'Beverage' }] } } },
  ],
};

describe('mess basics', () => {
  it('lists the four messes in the requested order, non-veg menus for Kadamba and Bakul', () => {
    expect(MESSES.map((m) => m.id)).toEqual(['kadamba', 'yuktahar', 'bakul', 'palash']);
    expect(MESSES.find((m) => m.id === 'kadamba')?.menuId).toBe('kadamba-nonveg');
    expect(MESSES.find((m) => m.id === 'bakul')?.menuId).toBe('bakul-nonveg');
  });

  it('maps app slots to mess meals', () => {
    expect(mealForSlot('breakfast')).toBe('breakfast');
    expect(mealForSlot('snack')).toBe('snacks');
    expect(mealForSlot('latenight')).toBeNull();
  });

  it('groups dining-API mess ids', () => {
    expect(messGroupFor('kadamba-veg')).toBe('kadamba');
    expect(messGroupFor('kadamba-nonveg-mild')).toBe('kadamba');
    expect(messGroupFor('yuktahar-jain')).toBe('yuktahar');
    expect(messGroupFor('palash')).toBe('palash');
    expect(messGroupFor('north')).toBeNull();
    expect(messGroupFor(null)).toBeNull();
  });

  it('knows the weekday of a day key', () => {
    expect(weekdayFor('2026-10-21')).toBe('wednesday');
    expect(weekdayFor('2026-10-25')).toBe('sunday');
  });
});

describe('extractDayMenus', () => {
  const menus = extractDayMenus(menusResponse, '2026-10-21');

  it('uses the non-veg menu and only that weekday', () => {
    expect(menus.kadamba?.lunch?.map((i) => i.item)).toEqual(['Live wheat roti', 'Dal makhni', 'Chicken curry']);
    expect(menus.kadamba?.snacks?.[0].item).toBe('Samosa');
  });

  it('drops empty items and meals', () => {
    expect(menus.bakul?.lunch).toBeUndefined();
    expect(menus.bakul?.dinner?.[0].item).toBe('Egg curry');
    expect(menus.palash).toBeUndefined();
  });

  it('survives junk', () => {
    expect(extractDayMenus(null, '2026-10-21')).toEqual({});
    expect(extractDayMenus({ data: 'nope' }, '2026-10-21')).toEqual({});
  });
});

describe('parseRegistration', () => {
  it('reads mess, cancellation and check-in per meal', () => {
    const reg = parseRegistration({
      data: {
        breakfast: { meal_mess: 'kadamba-nonveg', cancelled_at: null, availed_at: '2026-10-21T09:16:29+05:30' },
        lunch: { meal_mess: 'bakul-veg', cancelled_at: '2026-10-20T10:00:00+05:30', availed_at: null },
        dinner: null,
      },
    });
    expect(reg.breakfast).toEqual({
      mess: 'kadamba',
      apiMess: 'kadamba-nonveg',
      cancelled: false,
      availedAt: '2026-10-21T09:16:29+05:30',
    });
    expect(reg.lunch?.cancelled).toBe(true);
    expect(reg.lunch?.mess).toBe('bakul');
    expect(reg.dinner).toBeUndefined();
  });
});

describe('prompt text', () => {
  const menus = extractDayMenus(menusResponse, '2026-10-21');
  const mess = buildMessContext({ messId: 'kadamba', meal: 'lunch', menus, boughtExtras: ['2 egg omelette'] })!;
  const ctx: DayContext = {
    now: new Date(2026, 9, 21, 13, 0),
    slot: 'lunch',
    eatenAt: new Date(2026, 9, 21, 12, 45),
    profile: { name: '', age: 22, sex: 'male', heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintain', targetOverride: null },
    targets: { kcal: 2600, proteinG: 98, carbsG: 379, fatG: 79 },
    earlierMeals: [],
    consumedSoFar: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  };

  it('returns null when that mess has no menu for the meal', () => {
    expect(buildMessContext({ messId: 'palash', meal: 'lunch', menus })).toBeNull();
  });

  it('formats full and compact menus', () => {
    expect(formatMessMenu(mess, 'full')).toBe('Phulka/Chapathi: Live wheat roti; Dal: Dal makhni; Non-Veg: Chicken curry');
    expect(formatMessMenu(mess, 'compact')).toBe('Live wheat roti, Dal makhni, Chicken curry');
  });

  it('caps the compact menu for the on-device model', () => {
    const long = { ...mess, items: Array.from({ length: 60 }, (_, i) => ({ item: `Dish number ${i}`, category: 'X' })) };
    const text = formatMessMenu(long, 'compact');
    expect(text.length).toBeLessThan(470);
    expect(text.endsWith('…')).toBe(true);
  });

  it('adds the menu and bought extras to the shared context', () => {
    const text = describeContext({ ...ctx, mess });
    expect(text).toMatch(/Kadamba mess/);
    expect(text).toMatch(/Dal: Dal makhni/);
    expect(text).toMatch(/bought these extras for this meal: 2 egg omelette/);
  });

  it('only mentions the omelette extra for Kadamba dinner', () => {
    expect(describeContext({ ...ctx, mess })).not.toMatch(/Paid extras/);
    const dinner = buildMessContext({ messId: 'kadamba', meal: 'dinner', menus })!;
    expect(dinner.extras).toEqual(['2-egg omelette']);
    expect(describeContext({ ...ctx, slot: 'dinner', mess: dinner })).toMatch(/Paid extras sold at this mess: 2-egg omelette/);
    expect(buildMessContext({ messId: 'bakul', meal: 'dinner', menus })!.extras).toEqual([]);
  });

  it('leaves the context unchanged without a mess', () => {
    expect(describeContext(ctx)).not.toMatch(/mess/i);
    expect(describeContext({ ...ctx, mess: null })).toBe(describeContext(ctx));
  });

  it('reaches the chat-app handoff prompt without confusing the reply detector', () => {
    const prompt = buildHandoffPrompt({ ...ctx, mess }, { hasPhoto: true });
    expect(prompt).toMatch(/Chicken curry/);
    expect(looksLikeHandoffReply(prompt)).toBe(false);
  });

  it('reaches the on-device prompt', () => {
    expect(localUserText({ hasPhoto: true, menu: formatMessMenu(mess, 'compact') })).toMatch(/mess menu.*Dal makhni/);
    expect(localUserText({ hasPhoto: true })).not.toMatch(/mess menu/);
  });
});
