// Loads environment variables from .env.development.local / .env before any other
// module is evaluated. Must be the FIRST import in server.ts: ES module imports run
// depth-first in declaration order, so importing this module first guarantees
// process.env is populated before modules like src/db/index.ts (which reads
// process.env.DATABASE_URL at import time to create the pg Pool) are evaluated.
// A plain top-level statement (e.g. `dotenv.config()` written before other imports
// in server.ts) does NOT work for this, because import declarations are hoisted and
// all run before any regular statement in the importing file.
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development.local' });
dotenv.config();
