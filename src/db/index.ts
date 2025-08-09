import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// Detect if running in Cloudflare Workers environment
const isCloudflareWorker =
  typeof globalThis !== "undefined" && "Cloudflare" in globalThis;

// Database instance for Node.js environment
let dbInstance: any | null = null;

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
                offset: () => Promise.resolve([]) 
              }) 
            }) 
          }) 
        }) 
      }),
      insert: () => ({ 
        values: () => ({ 
          returning: () => Promise.resolve([{ 
            id: Math.floor(Math.random() * 1000),
            task_number: `MOCK-${Date.now()}`,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          }])
        })
      }),
      update: () => ({ 
        set: () => ({ 
          where: () => ({ 
            returning: () => Promise.resolve([{
              id: Math.floor(Math.random() * 1000),
              status: 'completed',
              updated_at: new Date()
            }])
          }) 
        }) 
      }),
      delete: () => ({ 
        where: () => Promise.resolve({ count: 1 }) 
      }),
    } as any;
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    // Workers environment uses minimal configuration
    return drizzle(mysql.createPool(databaseUrl) as any) as any;
  }

  // In Node.js environment, use singleton pattern  
  if (dbInstance) {
    return dbInstance;
  }

  // Node.js environment with connection pool configuration
  try {
    const pool = mysql.createPool(databaseUrl);
    dbInstance = drizzle(pool as any) as any;
  } catch (error) {
    console.error('Failed to create database connection:', error);
    // Return mock database for development
    return {
      select: () => ({ 
        from: () => ({ 
          where: () => ({ 
            orderBy: () => ({ 
              limit: () => ({ 
                offset: () => Promise.resolve([]) 
              }) 
            }) 
          }) 
        }) 
      }),
      insert: () => ({ 
        values: () => Promise.resolve({ insertId: "mock" })
      }),
      update: () => ({ 
        set: () => ({ 
          where: () => Promise.resolve() 
        }) 
      }),
      delete: () => ({ 
        where: () => Promise.resolve({ affectedRows: 1 }) 
      }),
    } as any;
  }

  return dbInstance;
}
