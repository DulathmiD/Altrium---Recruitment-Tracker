# Deploying Altrium HR to the Cloud

Your lecturer didn't name a platform, so this is a recommendation, not the
only option. It's picked for one reason: it needs zero ongoing cost and the
fewest moving parts for a team that's about to hit a deadline, not for
long-term production use.

## The one thing that would have broken any deployment

The frontend calls the API with relative paths (`fetch("/api/candidates")`,
etc. -- see `frontend/src/api/*.ts`). That only works today because Vite's
dev server proxies `/api` to `localhost:4000` (`frontend/vite.config.ts`).
Deploy the frontend and backend as two separate services (e.g. frontend on
Vercel, backend on Render) and every API call 404s, because `/api/...` would
resolve against the frontend's own domain instead of the backend.

Fixed this already: `backend/src/app.ts` now serves the built frontend
(`frontend/dist`) directly from the same Express server when that folder
exists, with a catch-all route so React Router's client-side routes still
work on refresh. Locally this is a no-op (`frontend/dist` doesn't exist when
you're running `npm run dev`), so nothing about your local workflow changes.
Also added a `"start": "tsx src/server.ts"` script to `backend/package.json`
-- there wasn't one before, only `dev`.

Net effect: **deploy one service**, not two. Simpler, and the relative-path
API calls just work because everything is same-origin.

## Recommended stack (free)

| Piece | Where | Why |
|---|---|---|
| MySQL database | [Aiven](https://aiven.io) free plan | Genuinely free, no time limit (unlike Railway's trial credit or PlanetScale, which dropped its free tier) |
| App (backend + built frontend) | [Render](https://render.com) free web service | No card required, one service to manage, handles the combined Express+static setup above |

Render's free web service spins down after 15 minutes idle and takes ~30-60
seconds to wake up on the next request -- fine for a demo, just warn
whoever's presenting to load the page a minute early.

### 1. Create the database (Aiven)

1. Sign up at aiven.io, create a **MySQL** service on the free plan.
2. Once it's running, copy the connection details (host, port, user,
   password, database name) from the service overview page.
3. Build a `DATABASE_URL` in Prisma's format:
   `mysql://USER:PASSWORD@HOST:PORT/DBNAME?sslaccept=strict`
   (Aiven requires SSL -- `sslaccept=strict` handles that for the
   `@prisma/adapter-mariadb` / `mysql2` driver you're already using.)

### 2. Push the schema and seed data

From your machine, temporarily point at the cloud database and run:

```
cd backend
DATABASE_URL="mysql://..." npx prisma migrate deploy
DATABASE_URL="mysql://..." npm run seed
```

(On Windows PowerShell: `$env:DATABASE_URL="mysql://..."; npx prisma migrate deploy`)

### 3. Deploy the app (Render)

1. Push your repo to GitHub if it isn't already.
2. On Render: **New > Web Service**, connect the repo.
3. Root directory: leave blank (repo root), since the build needs to touch
   both `frontend/` and `backend/`.
4. Build command:
   ```
   cd frontend && npm install && npm run build && cd ../backend && npm install
   ```
5. Start command:
   ```
   cd backend && npm start
   ```
6. Environment variables (Render dashboard -> Environment):
   - `DATABASE_URL` -- the Aiven connection string from step 1
   - `JWT_SECRET` -- any long random string
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` -- your
     Outlook/Gmail SMTP settings from `backend/.env`, if you want real email
     sending to work in the deployed version (optional -- without these it
     falls back to logging emails to the console, same as local dev when
     unconfigured)
   - `PORT` -- Render sets this automatically, don't override it
7. Deploy. First build takes a few minutes.

### 4. Verify

- `https://<your-app>.onrender.com/api/health` should return `{"status":"ok"}`
- `https://<your-app>.onrender.com/login` should load the real login screen
  and work with the seeded accounts (`hr@altrium.com` / `password123`, etc.)

## If you'd rather not touch Render/Aiven

Railway is the other reasonable option -- smoother UI, native MySQL so you
don't need a separate Aiven account -- but its free tier is a one-time $5
trial credit (about 2 weeks of a small always-on service) rather than a
permanent free tier, so it suits a "deploy right before the demo" workflow
better than something you want sitting live for weeks. Steps are the same
build/start commands above; Railway's UI walks you through the database and
env vars similarly.

## Sources

- [Platforms with a real free tier for developers in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Render vs Railway 2026 - Pricing, DX & When to Use Each](https://encore.dev/articles/render-vs-railway)
- [Aiven Blog - Free plan](https://aiven.io/blog/category/free-plan)
- [Railway Free Tier in 2026: What You Get and When It Runs Out](https://medium.com/@kuberns/railway-free-tier-in-2026-what-you-get-and-when-it-runs-out-2101fdca0998)
- [PlanetScale Pricing 2026](https://costbench.com/software/database-as-service/planetscale/)
