import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the Vercel-style serverless functions in /api during `vite dev`, so
 * the Razorpay flow works with `npm run dev` (not just `vercel dev`). In a
 * production build this plugin is inert — Vercel runs the functions itself.
 */
type Handler = (req: unknown, res: unknown) => unknown;

function devApi(env: Record<string, string>): Plugin {
  const routes: Record<string, string> = {
    '/api/create-order': './api/create-order.js',
    '/api/verify-payment': './api/verify-payment.js',
    '/api/place-order': './api/place-order.js',
    '/api/admin-create-user': './api/admin-create-user.js',
    '/api/razorpay-webhook': './api/razorpay-webhook.js',
  };
  // Variable specifier + @vite-ignore: resolved by Node at request time, not
  // bundled or statically type-checked (the handlers are plain .js).
  const load = (spec: string) =>
    import(/* @vite-ignore */ spec) as Promise<{ default: Handler }>;

  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // The handlers read secrets from process.env; loadEnv doesn't set it.
      //
      // Assigned through a helper because `process.env.X = undefined` stores the
      // *string* "undefined" — truthy, so a missing key sails past the handlers'
      // `if (!key)` config guards and fails much later as an opaque auth error.
      // Skipping the assignment leaves the var genuinely absent instead.
      const pass = (name: string, value: string | undefined) => {
        if (process.env[name] === undefined && value) process.env[name] = value;
      };
      pass('RAZORPAY_KEY_ID', env.RAZORPAY_KEY_ID);
      pass('RAZORPAY_KEY_SECRET', env.RAZORPAY_KEY_SECRET);
      pass('RAZORPAY_WEBHOOK_SECRET', env.RAZORPAY_WEBHOOK_SECRET);
      // place-order writes with the Supabase service role (bypasses RLS).
      pass('SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL);
      pass('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY);

      // Fail loudly at startup rather than at the worst possible moment —
      // mid-checkout, after the buyer's card has already been charged.
      for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_SECRET']) {
        if (!process.env[name]) {
          console.warn(`\n  ⚠  ${name} is not set — /api checkout routes will fail. Add it to .env and restart.\n`);
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const spec = routes[path];
        if (!spec) return next();

        let raw = '';
        for await (const chunk of req) raw += chunk;

        // The webhook verifies an HMAC over the UNPARSED body, so it must get
        // the raw string; every other route expects Vercel's parsed JSON.
        const wantsRawBody = path === '/api/razorpay-webhook';
        let body: unknown;
        if (wantsRawBody) {
          body = raw;
        } else {
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            body = undefined;
          }
        }

        // Adapt Node's res to the Vercel-style `res.status().json()` API.
        const shim = res as unknown as {
          status: (code: number) => typeof shim;
          json: (data: unknown) => void;
        };
        shim.status = (code: number) => {
          res.statusCode = code;
          return shim;
        };
        shim.json = (data: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          const mod = await load(spec);
          // Forward `headers`/`socket` too: the handlers read the buyer's bearer
          // token (place-order) and the client IP (rate limiter) off them. Passing
          // only { method, body } made `req.headers.authorization` throw a
          // TypeError *after* the buyer had already paid, so the payment was
          // captured but the order never got written.
          await mod.default(
            { method: req.method, url: req.url, headers: req.headers, socket: req.socket, body },
            res,
          );
        } catch (err) {
          console.error('[dev-api]', path, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dev API error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), devApi(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: { port: 5173 },
  };
});
