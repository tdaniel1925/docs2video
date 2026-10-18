/**
 * TEXTING ON/OFF (owner decision 2026-10-14: switched OFF).
 *
 * Client texting and hot-client alerts (Twilio) are built but switched off:
 * the Twilio account isn't active and US business texting needs A2P 10DLC
 * registration. While off, every texting screen is hidden, every texting
 * route answers "not found", and the old view-alert emails carry on as before.
 * To turn it back on, set NEXT_PUBLIC_TEXTING=on in Vercel (read at build time
 * on the client, at run time on the server) after Twilio is active and
 * supabase/migrations/20261010_texting_and_alerts.sql has been run.
 */
export const TEXTING_ON = process.env.NEXT_PUBLIC_TEXTING === 'on'
