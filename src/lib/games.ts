import { asc, count, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

export interface PaginatedGames {
    games: Game[];
    page: number;
    pageSize: number;
    totalGames: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title), asc(games.id));
    return rows.map(mapGame);
}

/** A page of games ordered by title, with pagination metadata. */
export async function getPaginatedGames(
    db: Database,
    page: number,
    pageSize: number,
): Promise<PaginatedGames> {
    if (!Number.isInteger(page) || page < 1) {
        throw new RangeError('Page must be a positive integer.');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1) {
        throw new RangeError('Page size must be a positive integer.');
    }

    const [{ totalGames }] = await db.select({ totalGames: count() }).from(games);
    const totalPages = Math.ceil(totalGames / pageSize);
    const rows = await baseGamesQuery(db)
        .orderBy(asc(games.title), asc(games.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    return {
        games: rows.map(mapGame),
        page,
        pageSize,
        totalGames,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
    };
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db
        .select({ id: games.id })
        .from(games)
        .orderBy(asc(games.title), asc(games.id));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
