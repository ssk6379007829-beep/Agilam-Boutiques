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
      process.env.RAZORPAY_KEY_ID ??= env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_SECRET ??= env.RAZORPAY_KEY_SECRET;
      // place-order writes with the Supabase service role (bypasses RLS).
      process.env.SUPABASE_URL ??= env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY;

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const spec = routes[path];
        if (!spec) return next();

        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          body = undefined;
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
          await mod.default({ method: req.method, body }, res);
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
