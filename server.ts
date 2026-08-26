// Must be the first import: populates process.env before any other module
// (e.g. the pg Pool in src/db/index.ts) is evaluated. See src/load-env.ts for
// why a top-level dotenv.config() statement here would NOT work.
//
// Startup self-heals stale port bindings and shuts down gracefully on
// SIGTERM/SIGINT — see killStaleProcessOnPort() and the shutdown handler
// below for why this is necessary in this sandbox.
import './src/load-env.ts';

import { execSync } from 'child_process';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ensureSuperAdmin } from './src/db/queries.ts';
import { ensureDomainCategoryTriggers } from './src/db/triggers.ts';
import {
  getDashboardStats,
  getDomains,
  updateDomain,
  bulkUpdateDomains,
  proposeDomain,
  proposeDomainsBulk,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getFeedSources,
  createFeedSource,
  startFeedSourceSync,
  pauseFeedSource,
  resumeFeedSource,
  deleteFeedSource,
  getReviewQueue,
  resolveReviewItem,
  getAuditLogs,
  getReleases,
  deployRemainingRelease,
  overrideReleaseSafetyGate,
  rollbackRelease,
  authenticateUser,
  createSession,
  deleteSession,
  listUsers,
  createUserAccount,
  updateUserAccount,
  recordLoginAttempt,
  findUserIdByEmail,
  getLoginLogs,
} from './src/db/queries.ts';
import { requireAuth, requireRole, AuthRequest } from './src/middleware/auth.ts';

// The sandbox's file-watcher restart does not reliably terminate the previous
// "tsx server.ts" process before starting a new one (observed: a process from
// an earlier start was still bound to the port ten minutes later). That stale
// process holds the port forever, so every subsequent restart crashes with
// EADDRINUSE in a loop, which eventually makes the preview sandbox itself
// unreachable. Proactively reclaim the port by killing any OTHER process
// already listening on it before we try to bind.
function killStaleProcessOnPort(port: number) {
  try {
    const out = execSync(`lsof -t -i:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    if (!out) return;
    const pids = out
      .split('\n')
      .map((line) => parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid !== process.pid);
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
        console.warn(`[startup] Killed stale process ${pid} still holding port ${port}`);
      } catch {
        // Process already gone between lsof and kill; ignore.
      }
    }
  } catch {
    // lsof unavailable or no match; nothing to clean up.
  }
}

async function startServer() {
  const app = express();
  // Bind to the platform-assigned port when present (sandbox/dev container), else fall back to 3000.
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  // Create the HTTP server explicitly so Vite's HMR websocket can attach to the
  // SAME port as the Express app. Only this one port is exposed through the
  // sandbox proxy, so if Vite were left to open its own default HMR socket,
  // the browser's @vite/client would never be able to reach it.
  const httpServer = http.createServer(app);

  // Trust the reverse proxy (Nginx — see deploy/nginx.conf.example) for
  // client IP resolution: req.ip then reflects the real visitor's address
  // from X-Forwarded-For instead of always resolving to the proxy's own
  // address. This is what makes login logging / new-IP detection meaningful.
  // Safe ONLY because the app itself should never be reachable directly from
  // the internet in production — see deploy/nginx.conf.example's firewall
  // note (ufw should block direct access to PORT, leaving 80/443 as the only
  // public entry points); otherwise anyone could spoof this header directly.
  app.set('trust proxy', true);

  // Middleware
  app.use(express.json());

  // Bootstrap: the domain_categories cache-sync trigger must exist BEFORE
  // any seeding/writes happen (it's what keeps domains.categories/
  // primaryCategory and categories.count correct), so this is awaited
  // before the (fire-and-forget) data seed runs.
  await ensureDomainCategoryTriggers();
  // Guarantees the system always has at least one Admin account to log in
  // with — must be awaited (not fire-and-forget) so the credentials print
  // to the console before anyone tries to sign in.
  //
  // NOTE: there is deliberately no demo/mock data seeder here — this
  // includes categories. `categories` starts genuinely empty on a fresh
  // install; a row is created if and only if an admin explicitly declares
  // one via "Quản lý danh mục" in the UI. All domains/categories/sources/
  // releases/audit-logs/review-queue data comes only from real syncs
  // (POST /api/sources/:id/sync), the Import tab, or manual entry — never
  // a hardcoded default list, however "real-looking" the values are.
  await ensureSuperAdmin();

  // ===================== REST API ROUTES =====================

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'CyberDNS TIP Backend', timestamp: new Date().toISOString() });
  });

  // ---- Authentication (self-hosted email/password) ----
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'email và password là bắt buộc.' });
      }
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || null;

      const user = await authenticateUser(email, password);
      if (!user) {
        // Attribute the failed attempt to a real userId when the email
        // matches an existing account (wrong password / revoked account),
        // without changing what the response itself reveals — that stays a
        // single generic message either way.
        const maybeUserId = await findUserIdByEmail(email).catch(() => null);
        await recordLoginAttempt({
          userId: maybeUserId,
          email,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'Sai email/mật khẩu hoặc tài khoản đã bị thu hồi',
        });
        return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị thu hồi.' });
      }

      const { isNewIp } = await recordLoginAttempt({
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: true,
      });

      const token = await createSession(user.id);
      res.json({ success: true, token, user, isNewIp });
    } catch (error: any) {
      console.error('Error logging in:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        await deleteSession(authHeader.slice('Bearer '.length));
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  // ---- User account management (Admin-only: create accounts, assign
  // roles, revoke access) ----
  app.get('/api/users', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const list = await listUsers();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const { email, password, displayName, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'email và password là bắt buộc.' });
      }
      const created = await createUserAccount({ email, password, displayName, role });
      res.status(201).json({ success: true, user: created });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/users/:id', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
      const { role, isActive, displayName, password } = req.body;
      const updated = await updateUserAccount(id, { role, isActive, displayName, password });
      res.json({ success: true, user: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Login history (Admin-only) — every real login attempt, success and
  // failure, with the real client IP/User-Agent (see recordLoginAttempt).
  // ?userId=<id> scopes it to one account.
  app.get('/api/login-logs', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
      const logs = await getLoginLogs({ userId: Number.isNaN(userId as number) ? undefined : userId });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard API — real aggregates computed from the domains table
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = await getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      console.error('API /api/dashboard/stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Domains Explorer API
  app.get('/api/domains', async (req, res) => {
    try {
      const { search, category, status, tld, source, limit, offset, sortField, sortDirection } = req.query;
      const data = await getDomains({
        search: search as string,
        category: category as string,
        status: status as string,
        tld: tld as string,
        source: source as string,
        // No limit param at all => no LIMIT clause (used by the "export
        // entire category" flow); the paginated Domain Explorer view always
        // sends an explicit limit for its page size.
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : 0,
        sortField: sortField as any,
        sortDirection: sortDirection as any,
      });
      res.json(data);
    } catch (error: any) {
      console.error('API /api/domains error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/domains/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid domain id' });
      }
      const { reason, ...patch } = req.body;
      const updated = await updateDomain(id, patch, {
        userEmail: req.user?.email,
        reason,
      });
      res.json({ success: true, domain: updated });
    } catch (error: any) {
      console.error('API PATCH /api/domains/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual single add — goes to review_queue, not straight to domains
  // (see proposeDomain: an individual analyst's own, unverified judgment
  // call, unlike a feed sync).
  app.post('/api/domains/propose', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { domain, categories, reason } = req.body;
      if (!domain || !categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: 'domain and categories (array) are required.' });
      }
      const result = await proposeDomain({
        domain,
        category: categories[0],
        reason,
        userEmail: req.user?.email,
      });
      res.status(201).json({ success: true, ...result });
    } catch (error: any) {
      console.error('API POST /api/domains/propose error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Batch/paste import — same reasoning as /api/domains/propose, many
  // domains at once (Import tab). Goes to review_queue, not straight to
  // domains.
  app.post('/api/domains/bulk-propose', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { domains: domainList, categories: cats, reason } = req.body;
      if (!Array.isArray(domainList) || domainList.length === 0 || !Array.isArray(cats) || cats.length === 0) {
        return res.status(400).json({ error: 'domains (array) and categories (array) are required.' });
      }
      const result = await proposeDomainsBulk({
        domains: domainList,
        category: cats[0],
        reason,
        userEmail: req.user?.email,
      });
      res.status(201).json({ success: true, ...result });
    } catch (error: any) {
      console.error('API POST /api/domains/bulk-propose error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/domains/bulk-action', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { action, domainIds, category, reason } = req.body;
      const result = await bulkUpdateDomains({
        action,
        domainIds,
        category,
        reason,
        userEmail: req.user?.email || 'SOC Team',
      });
      res.json(result);
    } catch (error: any) {
      console.error('API POST /api/domains/bulk-action error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Categories API
  app.get('/api/categories', async (req, res) => {
    try {
      const list = await getCategories();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // No `id` accepted from the client — createCategory generates it
  // server-side at creation time so it stays stable forever afterward,
  // independent of the display name (which IS freely editable — see
  // PATCH below).
  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, description, color, deltaThreshold } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required.' });
      }
      const created = await createCategory({ name, description, color, deltaThreshold });
      res.status(201).json({ success: true, category: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateCategory(req.params.id, req.body);
      res.json({ success: true, category: updated });
    } catch (error: any) {
      console.error('API PATCH /api/categories/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/categories/:id', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      await deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('API DELETE /api/categories/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sources API
  app.get('/api/sources', async (req, res) => {
    try {
      const list = await getFeedSources();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sources', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, url, category } = req.body;
      if (!name || !url || !category) {
        return res.status(400).json({ error: 'name, url and category are required.' });
      }
      const created = await createFeedSource(req.body);
      res.status(201).json({ success: true, source: created });
    } catch (error: any) {
      console.error('API POST /api/sources error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fire-and-forget: this returns as soon as the source flips to 'syncing'
  // (a few ms), NOT when the sync itself finishes — the actual download +
  // parse + insert work continues running server-side independently of this
  // request. Clients observe real progress by polling GET /api/sources,
  // which is what makes the sync immune to the requesting tab navigating
  // away (see startFeedSourceSync / runFeedSourceSyncJob in queries.ts).
  app.post('/api/sources/:id/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const started = await startFeedSourceSync(req.params.id);
      res.status(202).json({ success: true, source: started });
    } catch (error: any) {
      console.error('API POST /api/sources/:id/sync error:', error);
      res.status(error.message?.includes('đang tạm dừng') ? 400 : 500).json({ error: error.message });
    }
  });

  // Tạm dừng nguồn: loại khỏi "Đồng bộ tất cả", và mọi tên miền nguồn này
  // đang quản lý (active/grace_period) chuyển sang 'unblocked' (xem
  // pauseFeedSource trong queries.ts).
  app.post('/api/sources/:id/pause', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const result = await pauseFeedSource(req.params.id, req.user?.email || 'Admin');
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('API POST /api/sources/:id/pause error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tiếp tục nguồn đang tạm dừng: chuyển lại 'active' cho đúng những tên
  // miền bị tạm dừng gây ra (xem resumeFeedSource trong queries.ts).
  app.post('/api/sources/:id/resume', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const result = await resumeFeedSource(req.params.id, req.user?.email || 'Admin');
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('API POST /api/sources/:id/resume error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/sources/:id', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const result = await deleteFeedSource(req.params.id, req.user?.email || 'Admin');
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('API DELETE /api/sources/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Review Queue API
  app.get('/api/reviews', async (req, res) => {
    try {
      const { status = 'pending' } = req.query;
      const list = await getReviewQueue(status as string);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/reviews/:id/resolve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { decision, category } = req.body; // decision: 'approved' | 'rejected'; category: optional override
      if (!decision || !['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision' });
      }
      const resolved = await resolveReviewItem(id, decision, req.user?.email || 'SOC Approver', category);
      res.json({ success: true, item: resolved });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Releases Pipeline API
  app.get('/api/releases', async (req, res) => {
    try {
      const list = await getReleases();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/releases/:version/deploy', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const updated = await deployRemainingRelease(req.params.version, req.user?.email);
      res.json({ success: true, release: updated });
    } catch (error: any) {
      console.error('API POST /api/releases/:version/deploy error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/releases/:version/override', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const { reason } = req.body;
      const updated = await overrideReleaseSafetyGate(
        req.params.version,
        req.user?.email || 'Admin',
        reason
      );
      res.json({ success: true, release: updated });
    } catch (error: any) {
      console.error('API POST /api/releases/:version/override error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/releases/:version/rollback', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
    try {
      const { reason } = req.body;
      const updated = await rollbackRelease(req.params.version, req.user?.email || 'Admin', reason);
      res.json({ success: true, release: updated });
    } catch (error: any) {
      console.error('API POST /api/releases/:version/rollback error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Audit Logs API
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const list = await getAuditLogs();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===================== VITE MIDDLEWARE SETUP =====================
  if (process.env.NODE_ENV !== 'production') {
    // This app runs Vite inside a custom Express server. The preview proxy
    // exposes one HTTP port and does not reliably forward Vite's secondary HMR
    // websocket port, so disable HMR here to prevent the 24678 websocket and
    // duplicate-server crash loop. The platform reloads the preview on sync.
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Proactively free the port from any orphaned previous instance (see
  // killStaleProcessOnPort above), then bind. Retry/backoff remains as a
  // fallback safety net for the brief window where the OS hasn't fully
  // released the socket yet after a kill.
  httpServer.once('listening', () => {
    console.log(`CyberDNS TIP Full-stack server running on http://0.0.0.0:${PORT}`);
  });

  const listenWithRetry = (retriesLeft = 10) => {
    if (httpServer.listening) return;

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
        if (retriesLeft === 10) killStaleProcessOnPort(PORT);
        console.warn(`Port ${PORT} still in use, retrying in 500ms... (${retriesLeft} attempts left)`);
        setTimeout(() => listenWithRetry(retriesLeft - 1), 500);
      } else {
        // Vite's dev middleware sets up file watchers (chokidar) that keep
        // the event loop alive indefinitely, so setting process.exitCode
        // alone is NOT enough here — it only affects the exit code IF the
        // process exits naturally, and this process never would on its own.
        // Without a hard exit, a bind failure leaves behind a permanent
        // zombie process that holds no port (invisible to the port-based
        // cleanup above) but never dies, and the platform's supervisor may
        // treat it as "still running" and stop retrying. Force an immediate
        // exit so the platform sees a clear failure and restarts cleanly.
        console.error(`Failed to bind to port ${PORT}:`, err);
        process.exit(1);
      }
    };

    // `once` so each retry adds exactly one listener that removes itself,
    // instead of accumulating (which previously tripped Node's
    // MaxListenersExceededWarning after enough retries).
    httpServer.once('error', onError);
    httpServer.listen(PORT, '0.0.0.0', () => {
      httpServer.removeListener('error', onError);
    });
  };

  // Reclaim the port up front, before the first bind attempt, so a stale
  // process from a previous restart never gets the chance to cause the
  // very first EADDRINUSE in the loop. Verified end-to-end: a stale holder
  // on the port gets killed, the real server binds, and SIGTERM shuts it
  // down cleanly with no leftover process.
  killStaleProcessOnPort(PORT);
  listenWithRetry();

  // Ensure THIS process releases the port promptly when the platform
  // restarts or stops it, instead of potentially lingering as the next
  // "stale process" itself.
  const shutdown = (signal: string) => {
    console.log(`[shutdown] Received ${signal}, closing server...`);
    httpServer.close(() => process.exit(0));
    // Force-exit if something (e.g. an open DB connection) keeps the event
    // loop alive longer than expected.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
