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

export async function setGroupNiche(id: string, niche: string) {
    const db = await getDb();
    await db.run(`UPDATE groups SET niche=? WHERE id=?`, [niche, id]);
}

export interface GroupConfig {
    id: string;
    niche: string;
}

export async function getActiveGroups(): Promise<GroupConfig[]> {
    const db = await getDb();
    const rows = await db.all(`SELECT id, niche FROM groups WHERE active=1`);
    return rows.map(r => ({ id: r.id, niche: r.niche || 'tech' }));
}
