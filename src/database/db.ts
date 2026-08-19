import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
    if (dbInstance) return dbInstance;

    // Database will be created in the root folder of the project
    dbInstance = await open({
        filename: path.join(__dirname, '..', '..', 'bot_database.sqlite'),
        driver: sqlite3.Database
    });

    // Create the groups table if it doesn't exist
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT,
            active BOOLEAN DEFAULT 1,
            niche TEXT DEFAULT 'tech'
        )
    `);

    // Migration para bancos existentes
    try {
        await dbInstance.exec(`ALTER TABLE groups ADD COLUMN niche TEXT DEFAULT 'tech'`);
    } catch (e) {
        // Coluna já existe
    }

    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS sent_promos (
            link TEXT PRIMARY KEY
        )
    `);

    return dbInstance;
}
