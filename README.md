# Fresher

Fresher is a Next.js frontend with a Node.js backend for ordering fresh foods and cereals in Kenya.

## What was improved
- Rebuilt the customer interface with **Next.js** for a cleaner and more responsive experience.
- Preserved core business functionality: registration, login, catalog browsing, checkout, and order history.
- Kenyan market support remains built-in (KES pricing + Kenyan phone validation).

## Run locally
Open two terminals in the project root.

### Terminal 1: API server
```bash
npm install
npm run dev:api
```
Backend runs on `http://localhost:3001`.

### Terminal 2: Next.js frontend
```bash
npm run dev:web
```
Frontend runs on `http://localhost:3000`.

## Environment variables
- `PORT` (optional): backend port (default `3001`)
- `NEXT_PUBLIC_API_BASE_URL` (optional): frontend API URL (default `http://localhost:3001`)
- `JWT_SECRET` (optional): token signing secret

## Tests
```bash
npm test
```
