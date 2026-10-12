# News Outlet

A complete news publication platform: readers, writers, editors and admins work in one MERN app (React + Vite frontend, Express + MongoDB backend) with a real editorial workflow, live blogs, personalised feeds, newsletters, feeds for syndication and an installable offline-capable PWA.

**Live preview:** https://shishir19999.github.io/News-Outlet/ (browser-only, no server: the data lives in your browser)

| Home | Article | Live blog |
| --- | --- | --- |
| ![Home](docs/screenshots/home-desktop.png) | ![Article](docs/screenshots/article-desktop.png) | ![Live blog](docs/screenshots/live-blog.png) |

| Review desk | Version history with diff | Analytics |
| --- | --- | --- |
| ![Review desk](docs/screenshots/review-desk.png) | ![Revisions](docs/screenshots/revision-diff.png) | ![Analytics](docs/screenshots/analytics.png) |

| Phone: article | Phone: home | Phone: analytics |
| --- | --- | --- |
| ![Phone article](docs/screenshots/article-phone.png) | ![Phone home](docs/screenshots/home-phone.png) | ![Phone analytics](docs/screenshots/phone-analytics.png) |

| Fact check | Typo-tolerant search | For you |
| --- | --- | --- |
| ![Fact check](docs/screenshots/fact-check.png) | ![Search](docs/screenshots/search-typo-tolerance.png) | ![For you](docs/screenshots/for-you.png) |

| Author dashboard | Editor workflow | Users and roles |
| --- | --- | --- |
| ![Author dashboard](docs/screenshots/author-dashboard.png) | ![Editor workflow](docs/screenshots/editor-workflow.png) | ![Users and roles](docs/screenshots/users-and-roles.png) |

| Newsletter composer | Preview inbox | Live blog (real mode, Socket.IO) |
| --- | --- | --- |
| ![Newsletter](docs/screenshots/newsletter-admin.png) | ![Preview inbox](docs/screenshots/preview-inbox.png) | ![Live blog real mode](docs/screenshots/live-blog-real-mode.png) |

## Features

### For readers
- Homepage with hero, breaking-news ticker, alert banner, **trending** (views per day decayed by time), a **For you** strip, a "live now" strip, and opinion / analysis / fact-check picks
- Multi-section navigation with a **mega menu** (description, newest stories and popular topics per section), section pages with RSS links
- **Follow** sections and writers; the **For you** feed is ranked from what you follow (and why a story was picked is shown)
- Article page: reading time, **reading progress bar**, text size and line-height controls, **read aloud** (the browser's own speech, nothing is sent anywhere), **listen later** queue, saved articles, reading history, share (copy, native, social, e-mail), related stories, tags, writer box
- **Labels** for story types: News, Analysis, Opinion, **Fact check** (claim + verdict meter), **Sponsored** (clearly marked, sponsor named), **Live**
- **Photo galleries** with a keyboard-friendly lightbox, **video and podcast embeds** that load only after you press play (YouTube privacy-enhanced mode, Vimeo do-not-track, plain audio files; no tracking before that)
- **Reactions** (one per reader), **polls** (one vote per reader, results, closing time), **threaded comments** (three levels) with moderation and a **report** button; three reports send a comment back to the moderators
- **Live blogs**: new updates appear without reloading (Socket.IO in real mode, BroadcastChannel between browser tabs in the live preview)
- **Search** with suggestions as you type, typo tolerance ("did you mean"), filters (section, type, topic, date range, sort) and highlighted matches; **archive by date**; author pages
- **Newsletter** with topic preferences and **double opt-in** (confirm by e-mail), preference and unsubscribe links
- **Installable PWA**: app shell and the stories you read are cached; saved stories open **offline** from a copy kept on your device
- Light and dark theme, responsive from 320px, skip links, keyboard navigation, screen-reader labels, text alternatives for every chart, parallax only on hero and section headers (off for reduced motion, small screens and low-power devices)

### For the newsroom
- Four roles (table below) with an **editorial workflow**: draft, submitted, in review, changes requested, approved, scheduled, published, archived
- Editor comments and **requested changes** with a note, an assigned editor, a conversation thread on every article, and a **four-eyes rule**: an editor cannot approve or publish their own article (admins can)
- **Revision history** for every article with a word and line **diff**, and one-click **restore**
- **Review desk** for editors: queue by state, assignment filter, quick actions, and **headline A/B tests** (impressions, clicks, leader, one click to keep a winner)
- Author dashboard with own numbers (views, followers, comments, reactions, how far readers scroll)
- Editor tools: breaking-news flag, featured flag, alert banner (updates live for readers), polls, live-blog updates (post, pin, mark important, delete), comment moderation including reported comments
- Admin: users and roles (the last admin is protected), sections with ordering, site settings (comments, newsletter, registration), **audit log**, newsletter composer that sends a digest to confirmed subscribers (by topic)
- **Analytics** dashboard: views per day, views per section, traffic sources, reading depth, newsletter growth, top stories. Every chart has a caption, a text summary and a "View as table" alternative

### Syndication and SEO
- RSS 2.0 and Atom feeds for the whole site and for every section, `sitemap.xml`, `robots.txt`
- Share pages with Open Graph and Twitter tags and **schema.org NewsArticle JSON-LD** (opinion, analysis and live pieces use their specific types)
- In real mode the API generates all of this; for the live preview `npm run build:pages` writes the same files into `dist/` at build time

## Roles

| Role | Can do |
| --- | --- |
| **Reader** | Read, comment, react, vote, save, follow sections and writers, reading history, listen queue, newsletter preferences |
| **Author** | Everything a reader can, plus write articles (text, gallery, embeds, fact check, sponsored), save drafts, submit for review, answer editor notes, post live updates on own live blogs, see own stats. Cannot publish. Locked out of an article while it is with the editors |
| **Editor** | Everything an author can, plus see every article, review desk, assign, comment, request changes, approve, schedule, publish, archive, restore versions, breaking news, featured, headline tests, polls, live blogs, comment moderation, alert banner, analytics. Cannot approve or publish own articles |
| **Admin** | Everything an editor can, plus users and roles, sections, settings, audit log, newsletter composer and subscribers, deleting articles, fast-tracking drafts to published |

The permission table and the workflow live in `shared/rules.js` and are enforced by the API and the live preview with the same code.

### Editorial workflow

```
draft -> submitted -> in review -> approved -> scheduled or published -> archived
              \            \-> changes requested -> (author edits) -> submitted
               \-> back to draft (author withdraws)
```
Published articles can be unpublished into review, archived articles can be restored. Scheduled articles go live by themselves when their time comes.

## Two ways to run the frontend

| | Real mode (full stack) | Live preview (browser only) |
| --- | --- | --- |
| Needs | Node, MongoDB, the backend | Node only (static files) |
| Data | MongoDB, uploads on disk | `localStorage`, pictures stored as downsized data URLs |
| Real time | Socket.IO | BroadcastChannel between tabs |
| E-mail | SMTP (Gmail App Password) | **Preview inbox** page, nothing is sent |
| Feeds, sitemap | generated by the API | generated at build time into `dist/` |
| Start | `npm run dev` | `npm run dev:demo` |
| Build | `npm run build` | `npm run build:pages` (base `/News-Outlet/`, hash routes, output in `frontend/dist`) |

The live preview swaps the server layer for an in-browser backend (`frontend/src/demo/`) that answers the same paths with the same response shapes and the same rules. It starts with 46 original, fictional stories, a live blog, every editorial state, comments, polls, reactions and a few weeks of statistics. A banner explains this and offers **Reset preview data**. Sample logins (they only exist in your browser):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `admin123` |
| Editor | `editor@example.com` | `editor123` |
| Author | `author@example.com` | `author123` |
| Reader | `user@example.com` | `user123` |

All sample content is original placeholder text and generated artwork; nothing is copied and no pictures are hotlinked. Build output can be published from any static host or GitHub Pages.

### Shared code (no drift)
`shared/` holds the rules both modes use: roles and permissions, workflow transitions, validation, slugs and reading time, trending score, search ranking and typo tolerance, For-you scoring, diffs, headline tests, feeds and sample content. `node scripts/sync-shared.mjs` (or `npm run sync:shared` in `backend/` or `frontend/`) copies it to `backend/src/shared` and `frontend/src/shared`. A test in each package fails when the copies differ.

## Prerequisites
- Node.js 24+
- A running MongoDB instance (real mode only)

## Backend (`backend/`)
1. `cd backend && npm install`
2. Copy `.env-example` to `.env` and fill in your own values:

| Variable | Purpose |
| --- | --- |
| `HTTP_S`, `PORT`, `PUBLIC_URL` | Server host/port and the public URL used to build image links |
| `SITE_URL` | Public address of the website (frontend): used in e-mail links, feeds, the sitemap and CORS |
| `MODE` | `development` or `production` |
| `MONGODB_URL` | MongoDB connection string |
| `JWT_SECRET`, `JWT_EXPIRE` | JWT signing secret (use a long random value) and lifetime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_EMAIL` (alias `SMTP_USER`), `SMTP_PASSWORD`, `SMTP_FROM`, `RECIPIENT_EMAIL` | Mail settings for the contact form and the newsletter |
| `SEED_ADMIN_PASSWORD`, `SEED_EDITOR_PASSWORD`, `SEED_AUTHOR_PASSWORD`, `SEED_USER_PASSWORD` | Passwords for the seeded accounts (see Seeding) |

3. Scripts: `npm start`, `npm run dev`, `npm run seed`, `npm run mail:test`, `npm test`.

### E-mail (Gmail SMTP)
Contact-form messages, newsletter confirmations and digests are sent through SMTP, configured only by env in `backend/.env` (sender, recipient and credentials are never in the code). Gmail does not accept your normal password; create an **App Password**:

1. Turn on **2-Step Verification** for the sending Google account (https://myaccount.google.com/security).
2. Open https://myaccount.google.com/apppasswords, name it (for example `News newsletter`) and click **Create**.
3. Copy the 16-character password.
4. In `backend/.env` set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587          # STARTTLS. For implicit TLS use SMTP_PORT=465 and SMTP_SECURE=true
   SMTP_SECURE=false
   SMTP_EMAIL=you@example.com         # the Gmail address that owns the App Password
   SMTP_PASSWORD=xxxxxxxxxxxxxxxx     # the App Password from step 3
   RECIPIENT_EMAIL=you@example.com    # inbox that receives contact messages
   SITE_URL=https://news.example.com  # where the website lives, for links in e-mails
   ```
5. Verify with `cd backend && npm run mail:test` (prints `SUCCESS` or `FAIL` with the reason).
6. Restart the backend. It logs a warning at startup if `SMTP_PASSWORD` or `RECIPIENT_EMAIL` is missing.

Gmail only sends as the logged-in account, so `From` is `SMTP_FROM` or `SMTP_EMAIL`. **Double opt-in:** a new address is stored as *pending* and receives a confirmation link; only confirmed subscribers receive digests, and every digest has a preferences and unsubscribe link. Never commit real credentials (`backend/.env` is git-ignored).

### Real-time
The API server also runs Socket.IO. Clients join a room per live blog (`live:update` events), and receive `breaking` and `alert` events for the ticker and the alert banner. `SITE_URL` is used as the allowed origin.

### Logout and token revocation
Each user has a `tokenVersion` embedded in the JWT. `POST /logout` increments it, which invalidates every token previously issued to that user. Changing someone's role does the same, so a demoted user loses access immediately. `Auth.check` rejects tokens whose user no longer exists.

### Seeding
`npm run seed` is idempotent. It creates any missing sample accounts (admin, editor, author, reader), the sections and the original sample stories (46 articles in every editorial state, with revisions, review notes, live updates, comments, polls, reactions, statistics and subscribers). Existing records are keyed by e-mail, section name or slug and never duplicated or overwritten. On server start the seeder only runs when the users collection or the news collection is empty. Passwords come from the `SEED_*` variables (dev defaults `admin123`, `editor123`, `author123`, `user123` if unset; always set them outside local development).

### Testing
`cd backend && npm test` runs `node:test` + `supertest` against a throwaway database named `nw_news_test` on `mongodb://127.0.0.1:27017` (override with `TEST_MONGODB_URL`, which must contain `nw_news_test`); it is dropped afterwards. E-mail goes to a capture transport, so nothing is sent. Coverage: auth and roles, the full workflow including the four-eyes rule, revisions and restore, validation per article type, images, search and typo tolerance, trending and For-you, analytics sources and depth, headline tests, reactions and polls, threaded and reported comments, live blogs with a real Socket.IO client, double opt-in newsletters and digests, follows, feeds and share pages, settings, alert banner and audit log, seeding, and the shared-code drift check. `cd frontend && npm test` checks the helpers, the markdown renderer and the live-preview backend against the same rules, and that the shared copies are identical.

## Frontend (`frontend/`)
1. `cd frontend && npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_URL` (default `http://localhost:8080`).
3. Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run dev:demo`, `npm run build:pages`, `npm test`, `npm run lint`.

`npm run build:pages` builds the live preview and then runs `scripts/build-static.mjs`, which writes the RSS and Atom feeds (site and per section), `sitemap.xml`, `robots.txt` and one share page per story (`a/<slug>/`) into `dist/`. Set `SITE_URL` to change the public address used inside those files.

### Installable app and offline reading
`public/manifest.webmanifest`, icons and `public/sw.js` make the site installable. The service worker caches the app shell and the pages and data you read (network first, cache as fallback); requests with an Authorization header and everything private (sign-in, accounts, stats, newsletter) are never cached. Every saved story also keeps a copy on the device, so the Library works offline.

### Accessibility
Skip links, visible focus, labelled landmarks, keyboard-operable menus, galleries and polls, live regions for new live-blog updates, forms with associated errors, no information by colour alone, text alternatives for charts and artwork. Automated checks with axe (WCAG 2.1 A and AA plus best practices) were run for every role on desktop and phone.

## API
Everything from the earlier version still works. New and changed endpoints:

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/news` | public | `search` (typo tolerant, returns `suggestion`), `categoryId`, `tag`, `kind`, `authorId`, `from`/`to`, `period`, `featured`, `ids`, `archived=1`, `sort` |
| GET | `/news/trending`, `/news/for-you`, `/news/breaking`, `/news/archive` | public | Trending uses decayed daily views; For you takes `topics`, `authors`, `tags` |
| GET | `/news/manage/list?status=&assignee=` | author+ | Authors see their own, editors everything; includes counts per status |
| POST | `/news` | author+ | Always creates a draft; `status` may move it through the workflow if the rules allow |
| POST | `/news/:id/transition` | author+ | `{ to, note?, publishedAt? }`, rules in `shared/rules.js` |
| POST / PUT | `/news/:id/notes`, `/news/:id/assign` | author+ / editor+ | Review conversation, assigned editor |
| GET / POST | `/news/:id/revisions`, `/news/:id/revisions/:rid/restore` | owner or editor+ | Version history |
| POST | `/news/:id/view`, `/depth`, `/news/ab/impressions` | public | Views with traffic source, reading depth, headline test counters |
| POST | `/news/:id/ab/winner` | editor+ | Ends a headline test |
| GET / POST / PUT / DELETE | `/news/:id/live` | public / author or editor | Live-blog updates (pushed over Socket.IO) |
| GET / PUT / POST | `/news/:id/engagement`, `/reaction`, `/poll/vote` | public | One reaction and one vote per reader (`x-client-id` header or signed in) |
| GET / POST | `/comments`, `/comments/:id/report`, `/comments/manage/list` | public / moderators | Threads via `parentId`, reports, moderation queue (`status=reported`) |
| POST / GET / PUT | `/newsletter`, `/newsletter/confirm`, `/newsletter/preferences`, `/newsletter/unsubscribe` | public | Double opt-in and preferences by token |
| POST / GET | `/newsletter/send`, `/newsletter` | admin | Digest to confirmed subscribers; subscriber list |
| GET / PUT | `/settings` | public / editor+ (alert), admin (site) | Site name, switches, alert banner |
| GET | `/audit`, `/stats`, `/stats/me` | admin / editor+ / author+ | Audit log, analytics, own stats |
| GET | `/authors`, `/authors/:id`, `/search/suggest`, `/category/menu` | public | Writers, suggestions, mega-menu data |
| PUT | `/user/follows` | signed in | Followed sections and writers |
| GET | `/feed.xml`, `/atom.xml`, `/rss/:section.xml`, `/atom/:section.xml`, `/sitemap.xml`, `/robots.txt`, `/share/:slug` | public | Syndication, SEO and crawler-friendly share pages |
| POST | `/upload` | author+ | Picture upload for galleries |

Send the JWT in the `authorization` header (no `Bearer` prefix). Validation failures return `422 { success:false, message, errors:{field:msg} }`, duplicate slugs `409`, a rule violation `403` or `409`.

## Deploy with Docker
Files: `backend/Dockerfile`, `frontend/Dockerfile` (+ `frontend/nginx.conf`), `.dockerignore` files and `docker-compose.yml` (services `mongo`, `backend`, `frontend`).

1. `cp backend/.env-example backend/.env` and fill it in (strong `JWT_SECRET`, `SEED_*` passwords, `SMTP_*` values and `SITE_URL`). Compose overrides `PORT`, `MODE`, `PUBLIC_URL` and `MONGODB_URL`.
2. Optionally create a root `.env` with `PUBLIC_URL` and `VITE_API_URL` if the site is not served from `http://localhost:8080` (the frontend bakes `VITE_API_URL` in at build time, and it must be reachable from the *browser*).
3. `docker compose up --build -d`
4. Open the frontend at http://localhost:8081 and the API at http://localhost:8080.

Data persists in the named volumes `mongo_data`, `news_images` and `user_images`. Note: these Docker files were validated by review only; the Docker engine was not available when they were written.
