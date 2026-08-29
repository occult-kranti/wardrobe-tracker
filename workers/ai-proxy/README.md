# AI Proxy Worker

- This Cloudflare worker is a LEGACY standalone fallback for the AI vision relay.
- The active production edge function is `supabase/functions/ai-proxy/index.ts`.
- This worker only supports Kimi; the Supabase function supports Claude, Gemini, and Kimi.
- Kept for reference only; not deployed in production.
