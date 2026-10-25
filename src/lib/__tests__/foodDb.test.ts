/// <reference types="jest" />
import { findFood, gramsPerUnit, itemsFromParsed, normalize } from '../local/foodDb';
import { parseLocalReply } from '../local/localPrompt';
import { itemMacros } from '../nutrition';

describe('normalize', () => {
  it('lowercases, strips punctuation and plurals', () => {
    expect(normalize('2 Rotis!')).toBe('2 roti');
    expect(normalize('Masala Omelettes')).toBe('masala omelette');
    expect(normalize('glass')).toBe('glass');
  });
});

describe('findFood (bundled table)', () => {
  it.each([
    ['roti', 'Roti / Chapati (phulka)'],
    ['rotis', 'Roti / Chapati (phulka)'],
    ['chapati', 'Roti / Chapati (phulka)'],
    ['masala omlette', 'Masala omelette (2 eggs)'],
    ['paneer', 'Paneer curry (paneer masala)'],
    ['dal', 'Dal (tadka)'],
    ['curd rice', 'Curd rice (Dahi bhaat/Dahi chawal/ Perugu annam/Daddojanam/Thayir saadam)'],
  ])('%s → %s', (q, name) => {
    expect(findFood(q)[0].food.n).toBe(name);
  });

  it('returns weak or no matches for nonsense', () => {
    expect(findFood('qwzx blorp')[0]?.score ?? 0).toBeLessThan(0.5);
  });
});

describe('gramsPerUnit', () => {
  const roti = findFood('roti')[0].food;
  const paneer = findFood('paneer')[0].food;
  it('uses the food serving for pieces', () => {
    expect(gramsPerUnit(roti, { name: 'roti', quantity: 2, unit: 'piece' }).grams).toBe(35);
    expect(gramsPerUnit(roti, { name: 'roti', quantity: 2, unit: 'rotis' }).grams).toBe(35);
  });
  it('scales "small" household measures', () => {
    expect(gramsPerUnit(paneer, { name: 'paneer', quantity: 2, unit: 'small cup' }).grams).toBeCloseTo(140);
    expect(gramsPerUnit(paneer, { name: 'paneer', quantity: 1, unit: 'katori' }).grams).toBe(150);
  });
  it('treats grams literally', () => {
    expect(gramsPerUnit(paneer, { name: 'paneer', quantity: 200, unit: 'g' }).grams).toBe(1);
  });
  it('falls back to the model estimate for unknown units', () => {
    expect(gramsPerUnit(null, { name: 'x', quantity: 2, unit: 'blob', grams_estimate: 300 }).grams).toBe(150);
  });
});

describe('itemsFromParsed', () => {
  it('turns the example sentence into sensible items', () => {
    const items = itemsFromParsed([
      { name: 'roti', quantity: 2, unit: 'piece' },
      { name: 'paneer', quantity: 2, unit: 'small cup' },
      { name: 'masala omelette', quantity: 2, unit: 'piece' },
    ]);
    const kcal = items.map((i) => Math.round(itemMacros(i).kcal));
    expect(kcal[0]).toBeGreaterThan(150);
    expect(kcal[0]).toBeLessThan(220);
    expect(kcal[1]).toBeGreaterThan(400);
    expect(kcal[1]).toBeLessThan(700);
    expect(kcal[2]).toBeGreaterThan(350);
    expect(kcal[2]).toBeLessThan(550);
    expect(items.every((i) => (i.confidence ?? 0) >= 0.5)).toBe(true);
  });

  it('keeps unknown foods at 0 kcal for manual entry', () => {
    const [item] = itemsFromParsed([{ name: 'grandma special zorbo', quantity: 1, unit: 'bowl' }]);
    expect(item.name).toBe('grandma special zorbo');
    expect(item.kcalPerUnit).toBe(0);
    expect(item.confidence).toBe(0);
  });
});

describe('parseLocalReply', () => {
  it('reads model JSON and drops empty names', () => {
    const out = parseLocalReply(
      '{"dish_summary":"Roti paneer omelette","items":[{"name":"roti","quantity":2,"unit":"piece","grams_estimate":70},{"name":"","quantity":1,"unit":"x","grams_estimate":0},{"name":"paneer","quantity":"2","unit":"small katori","grams_estimate":"240"}]}',
    );
    expect(out.dishSummary).toBe('Roti paneer omelette');
    expect(out.items).toEqual([
      { name: 'roti', quantity: 2, unit: 'piece', grams_estimate: 70 },
      { name: 'paneer', quantity: 2, unit: 'small katori', grams_estimate: 240 },
    ]);
  });

  it('throws on no JSON', () => {
    expect(() => parseLocalReply('sorry')).toThrow();
  });
});

describe('split mixed dishes', () => {
  it.each([
    ['biryani rice', 'Biryani rice'],
    ['chicken pieces', 'Chicken pieces (curry/biryani, bone-in)'],
    ['paneer cubes', 'Paneer cubes (cooked in gravy)'],
    ['curry gravy', 'Curry gravy (onion-tomato)'],
    ['paneer butter masala gravy', 'Curry gravy (onion-tomato)'],
  ])('%s → %s', (q, name) => {
    expect(findFood(q)[0].food.n).toBe(name);
  });

  it('asks every engine to split biryani and curries', () => {
    const { SYSTEM_PROMPT } = jest.requireActual('../prompt');
    const { LOCAL_SYSTEM_PROMPT } = jest.requireActual('../local/localPrompt');
    expect(SYSTEM_PROMPT).toMatch(/Biryani rice" \+ "Chicken pieces/);
    expect(SYSTEM_PROMPT).toMatch(/Paneer cubes/);
    expect(LOCAL_SYSTEM_PROMPT).toMatch(/biryani rice" \+ "chicken pieces/);
    expect(LOCAL_SYSTEM_PROMPT).toMatch(/curry gravy/);
  });
});
