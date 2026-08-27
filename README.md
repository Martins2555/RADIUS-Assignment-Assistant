# RADIUS — AI Assignment Assistant

RADIUS is an AI-powered assignment assistant that helps students break down, understand, and solve academic tasks — from calculative problems (math, physics, engineering) to non-calculative assignments (writing, research, humanities).

**Live app:** [radius-assignment-assistant.vercel.app](https://radius-assignment-assistant.vercel.app)

## Features

- **Chat-based interface** — conversations stay on one page, styled like modern AI chat apps
- **Calculative & Non-Calculative modes** — tailored responses depending on subject type
- **Proper math rendering** — equations and fractions render in real formatted LaTeX via KaTeX, not raw text
- **Chat history** — past conversations are saved and accessible from the sidebar
- **Image upload & camera capture** — snap a photo of a handwritten or printed problem and RADIUS reads and solves it
- **Google OAuth & email/password login** — powered by Supabase Auth
- **Dark and light themes**

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Vercel Serverless Functions (`/api`)
- **Database & Auth & Storage:** Supabase (Postgres, Row Level Security, Storage buckets)
- **AI model:** Google Gemini API
- **Math rendering:** react-markdown, remark-math, rehype-katex, KaTeX

## Project Structure

- `api/generate.js` — Serverless function that talks to the Gemini API
- `src/App.jsx` — Main application (auth, dashboard, chat, settings)
- `src/supabaseClient.js` — Supabase client setup
- `src/index.css` — Global styles
- `public/` — Static assets
- `index.html` — Entry HTML file

## Environment Variables

Set these in your Vercel project settings:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable/anon key |
| `GEMINI_API_KEY` | Your Google Gemini API key |

## Database Schema

RADIUS uses two Supabase tables — `conversations` and `messages` — both protected with Row Level Security so each user only sees their own data. Images are stored in a Supabase Storage bucket (`assignment-images`), scoped per user.

## Developed By

RADIUS was developed by **Martins Chimezie Obasi**.
