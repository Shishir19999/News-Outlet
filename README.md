# News Outlet

A MERN news site with a public reader experience and an admin panel: React (Vite) frontend, Express + MongoDB backend.

**Live demo:** https://shishir19999.github.io/News-Outlet/ (browser-only, no server)

## Features
- Homepage with hero and featured stories, trending and latest sections, section chips
- Category pages with their own headers, breadcrumbs everywhere
- Article page with reading time, share buttons (copy link, native share, social, e-mail), related articles and comments
- Comments are moderated: they stay hidden until an admin approves them
- Bookmarks ("read later"): kept on the server for signed-in readers, in the browser for guests
- Search with highlighted matches and filters (section, date range, sort order), shareable URLs
- Newsletter sign-up (stored only, no mail is sent)
- Light and dark theme (follows the system, remembered), responsive from 320px, keyboard and screen reader friendly, skeleton loaders, empty and error states with retry, toasts and confirm dialogs, per-page title, description and Open Graph tags, 404 page
- Admin panel: dashboard with charts (views per day and per category), article CRUD with a Markdown editor, live preview and image upload, draft / publish / schedule, category and user management, comment moderation queue, subscriber list

### Parallax and scroll effects
The homepage hero, the newsletter band and the category headers use a gentle parallax and scroll-reveal. It only changes `transform` and `opacity`, is driven by `IntersectionObserver` and `requestAnimationFrame` (no libraries), and is switched off for `prefers-reduced-motion`, narrow screens and low-power or data-saver devices. The admin tables and editor never use it.

## Two ways to run the frontend
| | Full stack | Browser-only demo |
| --- | --- | --- |
| Needs | Node, MongoDB, the backend | Node only (static files) |
| Data | MongoDB, uploads on disk | `localStorage`, images stored as downsized data URLs |
| Start | `npm run dev` | `npm run dev:demo` |
| Build | `npm run build` | `npm run build:pages` (base `/News-Outlet/`, hash routes, output in `frontend/dist`) |

The demo swaps the server layer for an in-browser backend with the same interface (32 sample articles, comments, users, simulated latency). A "Demo mode" banner explains this and offers **Reset demo data**. Demo logins (they only exist in your browser):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `admin123` |
| Reader | `user@example.com` | `user123` |

`npm run build:pages` produces a static site that can be published from any static host or GitHub Pages; nothing in it talks to a server, sends e-mail or stores anything remotely.

## Prerequisites
- Node.js 24+
- A running MongoDB instance

## Backend (`backend/`)
1. `cd backend && npm install`
2. Copy `.env-example` to `.env` and fill in your own values:

| Variable | Purpose |
| --- | --- |
| `HTTP_S`, `PORT`, `PUBLIC_URL` | Server host/port and the public URL used to build image links |
| `MODE` | `development` or `production` |
| `MONGODB_URL` | MongoDB connection string |
| `JWT_SECRET`, `JWT_EXPIRE` | JWT signing secret (use a long random value) and lifetime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_EMAIL` (alias `SMTP_USER`), `SMTP_PASSWORD`, `SMTP_FROM`, `RECIPIENT_EMAIL` | Mail settings for the contact form |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | Passwords for the seeded accounts (see Seeding) |

3. Scripts: `npm start` runs `node src/index.js`; `npm run dev` runs it under nodemon; `npm test` runs the automated tests (see Testing).

### Contact form email (Gmail SMTP)
Contact-form messages are sent through Gmail SMTP to `RECIPIENT_EMAIL`, configured only by env in `backend/.env`. Gmail does not accept your normal password; create an **App Password**:

1. Sign in to the Google account that will send the mail and turn on **2-Step Verification** (https://myaccount.google.com/security).
2. Open https://myaccount.google.com/apppasswords, enter a name such as `NEWS contact form` and click **Create**.
3. Copy the 16-character password Google shows (spaces do not matter).
4. In `backend/.env` set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587          # STARTTLS. For implicit TLS use SMTP_PORT=465 and SMTP_SECURE=true
   SMTP_SECURE=false
   SMTP_EMAIL=you@example.com         # the Gmail address that owns the App Password
   SMTP_PASSWORD=xxxxxxxxxxxxxxxx     # the App Password from step 3
   RECIPIENT_EMAIL=you@example.com    # inbox that receives contact messages
   ```
5. Verify: `cd backend && npm run mail:test` sends one test email through the configured SMTP and prints `SUCCESS` or `FAIL` with the reason (recipient: `MAIL_TEST_TO`, else `RECIPIENT_EMAIL`).
6. Restart the backend. At startup it logs a warning if `SMTP_PASSWORD` or `RECIPIENT_EMAIL` is missing.

Gmail only sends as the logged-in account, so `From` is `SMTP_FROM` or `SMTP_EMAIL`; the visitor's address is set as `Reply-To`. Never commit real credentials (`backend/.env` is git-ignored).

### Logout and token revocation
Each user has a `tokenVersion` (default 0) that is embedded in the JWT. `POST /logout` (requires the `authorization` header) increments it, which invalidates every token previously issued to that user (all devices). `Auth.check` and `POST /login/toke-check` also reject tokens whose user no longer exists. Tokens issued before this feature (no `tokenVersion`) are treated as version 0. The frontend admin panel calls `/logout` before clearing `localStorage`.

### Testing
`cd backend && npm test` runs `node:test` + `supertest` against a throwaway database `news_test` on `mongodb://127.0.0.1:27017` (override with `TEST_MONGODB_URL`, which must contain `news_test`); it is dropped afterwards. The contact mailer is replaced by a stub, so no email is sent. Tests cover auth, role gates, news CRUD + image cleanup, slug rules, pagination, contact validation and token revocation.

### Seeding
`npm run seed` (in `backend/`) is idempotent and can be run any number of times. It creates any missing demo accounts, 5 categories (Education, Sports, Weathers, Books, Technology) and sample news items (no images); existing records are never duplicated or overwritten. On server startup the user seeder only runs when the `users` collection is empty, categories are created if missing, and demo news is created only when there is no news at all.

Demo logins (passwords come from `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`; if unset the insecure dev defaults below are used, so always set them outside local development):

| Role | Email | Default password |
| --- | --- | --- |
| admin | `admin@example.com` | `admin123` |
| user | `user@example.com` | `user123` |

Note: `express.static` is configured with `redirect: false`, otherwise the `public/news` upload directory redirects `GET /news` to `/news/`.

### Roles and permissions
- Public: list/read news and categories, register (always created as `user`), contact form.
- Any logged-in user: create news, read users, view own profile, edit/delete own account and profile image.
- `admin` only: update/delete news, create/update/delete categories, change user roles, edit/delete other users.

Send the JWT in the `authorization` header (no `Bearer` prefix).

## Frontend (`frontend/`)
1. `cd frontend && npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_URL` (default `http://localhost:8080`).
3. Scripts: `npm run dev` (dev server), `npm run build` (production build), `npm run preview`, `npm run dev:demo` and `npm run build:pages` (browser-only demo), `npm test` (unit tests for the demo backend and helpers), `npm run lint`.

## More API endpoints
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/news/manage/list?status=&search=` | logged-in | Admins see everything, users only their own articles (drafts and scheduled included) |
| POST | `/news/:id/view` | public | Counts a view (feeds the dashboard) |
| GET | `/comments?newsId=` | public | Approved comments only |
| POST | `/comments` | public | `newsId`, `body`, `name` (signed-in users use their own name); stays `pending` until approved |
| GET / PUT / DELETE | `/comments/manage/list`, `/comments/:id` | admin | Moderation queue; `PUT { status: pending|approved|rejected }` |
| GET / PUT / DELETE | `/bookmarks`, `/bookmarks/:newsId` | logged-in | Per-user reading list |
| POST / GET / DELETE | `/newsletter`, `/newsletter/:id` | public / admin | Stores addresses only |
| GET | `/stats?days=14` | admin | Totals, views per day and per category, top articles |

News also accepts `status` (`draft`, `published`, `scheduled`), `publishedAt` and `featured`; the public list only returns live articles and supports `featured`, `ids`, `period` (days) and `sort` (`latest`, `popular`, `oldest`).

## News API
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/news?page=1&limit=9&search=term&categoryId=...` | public | Paginated: `{ news, page, limit, total, pages }` (`limit` max 50, default 9). `search` matches title or summary (case-insensitive, literal text). |
| GET | `/news/:id`, `/news/news-details/:slug` | public | |
| POST | `/news` | logged-in | multipart: `categoryId`, `title`, `summary`, optional `slug`, `description`, `image` |
| PUT | `/news/:id` | admin | Same fields, all optional; optional `image` replaces the old one (old file is deleted) |
| DELETE | `/news/:id` | admin | Deletes the item and its image file |

Validation (create/update): `categoryId` must be an existing category, `title` and `summary` are required (max 200/1000 chars). Failures return `422 { success:false, message, errors:{field:msg} }`; duplicate slugs return `409`.

Slug rules: on create the slug is the slugified `slug` field, or the title if omitted. On update the existing slug is kept unless `slug` is sent; a non-empty value is slugified and must be unique, an empty value regenerates it from the title.

The admin sidebar shows the Category menu only to users with the `admin` role (the API enforces this regardless).

## Deploy with Docker
Files: `backend/Dockerfile`, `frontend/Dockerfile` (+ `frontend/nginx.conf`), `.dockerignore` files and `docker-compose.yml` (services `mongo`, `backend`, `frontend`).

1. `cp backend/.env-example backend/.env` and fill it in (set a strong `JWT_SECRET`, `SEED_*` passwords and the `SMTP_*` values; see the Gmail steps above). Compose overrides `PORT`, `MODE`, `PUBLIC_URL` and `MONGODB_URL` (the database is `news` on the `mongo` service).
2. Optionally create a root `.env` with `PUBLIC_URL` and `VITE_API_URL` if the site is not served from `http://localhost:8080` (the frontend bakes `VITE_API_URL` in at build time, and it must be reachable from the *browser*).
3. `docker compose up --build -d`
4. Open the frontend at http://localhost:8081 and the API at http://localhost:8080. The backend seeds demo data on first start.

Data persists in the named volumes `mongo_data`, `news_images` and `user_images`. Stop with `docker compose down` (add `-v` to also delete the data).

Note: these Docker files were validated by review only; the Docker engine was not running when they were written, so they have not been built or started.
