// IndexedDB database setup using Dexie
// Stores: drivers, projects, settings

import Dexie, { type Table } from 'dexie';
import type { Driver, Project } from '@/types';

export interface Settings {
  id: string;
  key: string;
  value: any;
}

export class SpeakerDesignDB extends Dexie {
  drivers!: Table<Driver, string>;
  projects!: Table<Project, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('SpeakerDesignDB');
    this.version(1).stores({
      drivers: 'id, manufacturer, model, type, createdAt',
      projects: 'id, name, createdAt',
      settings: 'id, key',
    });
  }
}

export const db = new SpeakerDesignDB();

// ---------------------------------------------------------------------------
// Driver CRUD
// ---------------------------------------------------------------------------

export async function saveDriver(driver: Driver): Promise<void> {
  await db.drivers.put(driver);
}

export async function getDriver(id: string): Promise<Driver | undefined> {
  return db.drivers.get(id);
}

export async function getAllDrivers(): Promise<Driver[]> {
  return db.drivers.orderBy('createdAt').toArray();
}

export async function deleteDriver(id: string): Promise<void> {
  await db.drivers.delete(id);
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('createdAt').toArray();
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<any> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting?.value;
}

export async function setSetting(key: string, value: any): Promise<void> {
  await db.settings.put({ id: key, key, value });
}
