import * as SQLite from 'expo-sqlite';
import type { FoodItem, Meal, Profile, Recommendation, Slot } from './types';

const DATABASE_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('bentometer.db');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;
  if (version === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL,
  sex TEXT NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  activity TEXT NOT NULL,
  goal TEXT NOT NULL,
  target_override INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  eaten_at TEXT NOT NULL,
  photo_uri TEXT,
  note TEXT NOT NULL DEFAULT '',
  dish_summary TEXT NOT NULL DEFAULT '',
  recommendation_json TEXT,
  model_used TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS meals_date ON meals (date, eaten_at);
CREATE TABLE IF NOT EXISTS food_items (
  id TEXT PRIMARY KEY NOT NULL,
  meal_id TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  portion TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  kcal_per_unit REAL NOT NULL,
  protein_per_unit REAL NOT NULL,
  carbs_per_unit REAL NOT NULL,
  fat_per_unit REAL NOT NULL,
  confidence REAL
);
CREATE INDEX IF NOT EXISTS food_items_meal ON food_items (meal_id, position);
`);
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// ---------- profile & settings ----------

interface ProfileRow {
  name: string;
  age: number;
  sex: Profile['sex'];
  height_cm: number;
  weight_kg: number;
  activity: Profile['activity'];
  goal: Profile['goal'];
  target_override: number | null;
}

export async function getProfile(): Promise<Profile | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  if (!r) return null;
  return {
    name: r.name,
    age: r.age,
    sex: r.sex,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    activity: r.activity,
    goal: r.goal,
    targetOverride: r.target_override,
  };
}

export async function saveProfile(p: Profile): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile (id, name, age, sex, height_cm, weight_kg, activity, goal, target_override)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, age = excluded.age, sex = excluded.sex,
       height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, activity = excluded.activity,
       goal = excluded.goal, target_override = excluded.target_override`,
    p.name, p.age, p.sex, p.heightCm, p.weightKg, p.activity, p.goal, p.targetOverride,
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

// ---------- meals ----------

interface MealRow {
  id: string;
  date: string;
  slot: Slot;
  eaten_at: string;
  photo_uri: string | null;
  note: string;
  dish_summary: string;
  recommendation_json: string | null;
  model_used: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  meal_id: string;
  name: string;
  portion: string;
  quantity: number;
  unit: string;
  kcal_per_unit: number;
  protein_per_unit: number;
  carbs_per_unit: number;
  fat_per_unit: number;
  confidence: number | null;
}

function toItem(r: ItemRow): FoodItem {
  return {
    id: r.id,
    name: r.name,
    portion: r.portion,
    quantity: r.quantity,
    unit: r.unit,
    kcalPerUnit: r.kcal_per_unit,
    proteinPerUnit: r.protein_per_unit,
    carbsPerUnit: r.carbs_per_unit,
    fatPerUnit: r.fat_per_unit,
    confidence: r.confidence,
  };
}

function toMeal(r: MealRow, items: FoodItem[]): Meal {
  let recommendation: Recommendation | null = null;
  if (r.recommendation_json) {
    try {
      recommendation = JSON.parse(r.recommendation_json);
    } catch {
      recommendation = null;
    }
  }
  return {
    id: r.id,
    date: r.date,
    slot: r.slot,
    eatenAt: r.eaten_at,
    photoUri: r.photo_uri,
    note: r.note,
    dishSummary: r.dish_summary,
    recommendation,
    modelUsed: r.model_used,
    items,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function attachItems(db: SQLite.SQLiteDatabase, rows: MealRow[]): Promise<Meal[]> {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => '?').join(',');
  const items = await db.getAllAsync<ItemRow>(
    `SELECT * FROM food_items WHERE meal_id IN (${placeholders}) ORDER BY position`,
    rows.map((r) => r.id),
  );
  const byMeal = new Map<string, FoodItem[]>();
  for (const it of items) {
    const list = byMeal.get(it.meal_id) ?? [];
    list.push(toItem(it));
    byMeal.set(it.meal_id, list);
  }
  return rows.map((r) => toMeal(r, byMeal.get(r.id) ?? []));
}

export async function getMealsForDate(date: string): Promise<Meal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals WHERE date = ? ORDER BY eaten_at', date);
  return attachItems(db, rows);
}

export async function getMeal(id: string): Promise<Meal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MealRow>('SELECT * FROM meals WHERE id = ?', id);
  if (!row) return null;
  const [meal] = await attachItems(db, [row]);
  return meal;
}

export async function getAllMeals(): Promise<Meal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals ORDER BY date, eaten_at');
  return attachItems(db, rows);
}

/** Insert or replace a meal and all of its items. */
export async function saveMeal(meal: Meal): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO meals (id, date, slot, eaten_at, photo_uri, note, dish_summary, recommendation_json, model_used, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET date = excluded.date, slot = excluded.slot, eaten_at = excluded.eaten_at,
         photo_uri = excluded.photo_uri, note = excluded.note, dish_summary = excluded.dish_summary,
         recommendation_json = excluded.recommendation_json, model_used = excluded.model_used,
         updated_at = excluded.updated_at`,
      meal.id, meal.date, meal.slot, meal.eatenAt, meal.photoUri, meal.note, meal.dishSummary,
      meal.recommendation ? JSON.stringify(meal.recommendation) : null, meal.modelUsed,
      meal.createdAt, meal.updatedAt,
    );
    await tx.runAsync('DELETE FROM food_items WHERE meal_id = ?', meal.id);
    for (const [i, it] of meal.items.entries()) {
      await tx.runAsync(
        `INSERT INTO food_items (id, meal_id, position, name, portion, quantity, unit, kcal_per_unit,
           protein_per_unit, carbs_per_unit, fat_per_unit, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        it.id, meal.id, i, it.name, it.portion, it.quantity, it.unit, it.kcalPerUnit,
        it.proteinPerUnit, it.carbsPerUnit, it.fatPerUnit, it.confidence,
      );
    }
  });
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', id);
}

/** Total kcal per day between two day keys (inclusive). */
export async function getDailyKcal(from: string, to: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; kcal: number }>(
    `SELECT m.date AS date, COALESCE(SUM(f.kcal_per_unit * f.quantity), 0) AS kcal
     FROM meals m LEFT JOIN food_items f ON f.meal_id = m.id
     WHERE m.date BETWEEN ? AND ?
     GROUP BY m.date`,
    from, to,
  );
  return Object.fromEntries(rows.map((r) => [r.date, r.kcal]));
}
