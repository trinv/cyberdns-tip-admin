import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

// SSL is off by default here because this file is normally run against a
// local Cloud SQL Auth Proxy tunnel (or a local Postgres), matching the
// runtime pool's default for local hosts in src/db/index.ts. Set DB_SSL=true
// to migrate directly against a remote host that requires TLS.
const ssl = process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false;

// Prefer a single DATABASE_URL when present (e.g. CI, or environments with
// no separate admin credentials); otherwise fall back to the discrete
// SQL_HOST/SQL_DB_NAME/SQL_ADMIN_USER/SQL_ADMIN_PASSWORD vars used for
// interactive migrations against Cloud SQL.
const dbCredentials = process.env.DATABASE_URL
  ? { url: process.env.DATABASE_URL, ssl }
  : (() => {
      const sqlHost = process.env.SQL_HOST;
      const sqlDbName = process.env.SQL_DB_NAME;
      const user = process.env.SQL_ADMIN_USER;
      const password = process.env.SQL_ADMIN_PASSWORD;

      if (!sqlHost || !sqlDbName || !user || !password) {
        throw new Error(
          "Missing PostgreSQL migration credentials: set DATABASE_URL, or all of " +
            "SQL_HOST / SQL_DB_NAME / SQL_ADMIN_USER / SQL_ADMIN_PASSWORD, in your environment (see .env.example)."
        );
      }

      return {
        host: sqlHost,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        user,
        password,
        database: sqlDbName,
        ssl,
      };
    })();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials,
  verbose: true,
});
