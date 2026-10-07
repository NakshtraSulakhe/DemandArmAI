# DemandArm call QA

Console for pulling CRM call leads, transcribing the recording, editing the transcript, and scoring it against each client's rules.

## Run

1. Copy environment values into `.env` (this file is not committed):
   - `DATABASE_URL` — MySQL connection string
   - `GEMINI_API_KEY` — used once if Settings has no Gemini key yet
   - `ADMIN_PASSWORD` — optional. When set, the console asks for this password
   - `WEBHOOK_SECRET` — optional. Otherwise set the webhook secret in Settings
   - `CREDENTIAL_ENCRYPTION_KEY` — key used to encrypt saved API tokens
2. Apply the database schema: `npx prisma db push`
3. Start the app: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

In Settings, add the CRM endpoint and token, the Gemini key, and a webhook secret if the CRM posts leads in. New client codes arrive without a prompt. Add the prompt and qualification rules in Configuration, then retry those leads from the queue.

The queue keeps running while the pipeline is started. Stop Pipeline pauses new work and that choice is saved.

## What a lead does

Sync or webhook → queue → transcription → transcript edit → QA score. A reviewer can change the decision. Their name is stored with the override. If a CRM write-back URL is set, the decision is posted there.
