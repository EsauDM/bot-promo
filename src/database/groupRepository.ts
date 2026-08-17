import { getDb } from './db';

export async function addGroup(id: string, name: string) {
    const db = await getDb();
    await db.run(
        `INSERT INTO groups (id, name, active) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET active=1, name=?`,
        [id, name, name]
    );
}

export async function removeGroup(id: string) {
    const db = await getDb();
    await db.run(`UPDATE groups SET active=0 WHERE id=?`, [id]);
}

export async function getActiveGroups(): Promise<string[]> {
    const db = await getDb();
    const rows = await db.all(`SELECT id FROM groups WHERE active=1`);
    return rows.map(r => r.id);
}
