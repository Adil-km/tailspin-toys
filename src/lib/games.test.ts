import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getPaginatedGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns a page of games with stable ordering and metadata', async () => {
        await seedGames(db, 13);

        const firstPage = await getPaginatedGames(db, 1, 6);
        const lastPage = await getPaginatedGames(db, 3, 6);

        expect(firstPage.games.map((game) => game.title)).toEqual([
            'Game 01',
            'Game 02',
            'Game 03',
            'Game 04',
            'Game 05',
            'Game 06',
        ]);
        expect(firstPage.totalGames).toBe(13);
        expect(firstPage.totalPages).toBe(3);
        expect(firstPage.hasPreviousPage).toBe(false);
        expect(firstPage.hasNextPage).toBe(true);
        expect(lastPage.games.map((game) => game.title)).toEqual(['Game 13']);
        expect(lastPage.hasPreviousPage).toBe(true);
        expect(lastPage.hasNextPage).toBe(false);
    });

    it('returns an empty page when the requested page is beyond the collection', async () => {
        await seedGames(db, 2);

        const pagination = await getPaginatedGames(db, 3, 6);

        expect(pagination.games).toEqual([]);
        expect(pagination.totalPages).toBe(1);
        expect(pagination.hasPreviousPage).toBe(true);
        expect(pagination.hasNextPage).toBe(false);
    });

    it.each([
        [0, 6],
        [1, 0],
        [1.5, 6],
    ])('rejects invalid pagination input (%s, %s)', async (page: number, pageSize: number) => {
        await expect(getPaginatedGames(db, page, pageSize)).rejects.toThrow(RangeError);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
