import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Database instance (singleton for Node.js/Next.js dev to avoid pool explosion)
let dbInstance: any | null = null;
let sqlInstance: any | null = null;

export function db() {
  const databaseUrl = process.env.DATABASE_URL;

  // For development without database, return a mock object
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set, using mock database for development");
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: Math.floor(Math.random() * 1000),
                task_number: `MOCK-${Date.now()}`,
                status: "pending",
                created_at: new Date(),
                updated_at: new Date(),
              },
            ]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: Math.floor(Math.random() * 1000),
                  status: "completed",
                  updated_at: new Date(),
                },
              ]),
          }),
        }),
      }),
      delete: () => ({ where: () => Promise.resolve({ count: 1 }) }),
    } as any;
  }

  // Reuse existing instance in Node.js
  if (dbInstance) return dbInstance;

  try {
    // Create postgres client and drizzle db
    sqlInstance = postgres(databaseUrl, {
      prepare: false,
      max: 10,
    });
    dbInstance = drizzle(sqlInstance as any) as any;
  } catch (error) {
    console.error("Failed to create PostgreSQL connection:", error);
    // Fallback to mock for development resilience
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({ values: () => Promise.resolve({ insertId: "mock" }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve({ affectedRows: 1 }) }),
    } as any;
  }

  return dbInstance;
}
