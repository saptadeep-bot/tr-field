// send-push: delivers queued notifications to the team's phones.
//
// The database queues a row in `notifications` and calls this function. It
// sends every unsent row to each phone the person has signed up, then marks
// the row sent. Anyone calling it can only make it deliver what the database
// has already queued, so it needs no sign-in ("Verify JWT" off).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@…)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@turnandriverbespoke.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

Deno.serve(async () => {
  const { data: rows, error } = await sb.from('notifications').select('*').is('sent_at', null)
    .gt('created_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('id').limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0, gone = 0;
  for (const n of rows || []) {
    // Claim the row first, so two calls at once never send it twice.
    const { data: claimed } = await sb.from('notifications').update({ sent_at: new Date().toISOString() }).eq('id', n.id).is('sent_at', null).select('id');
    if (!claimed || !claimed.length) continue;
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', n.user_id);
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag });
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' });
        sent++;
      } catch (e) {
        // The phone unsubscribed or the app was removed: forget it.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint); gone++; }
        else console.error('push failed', e && e.statusCode, e && e.body);
      }
    }
  }
  return Response.json({ queued: (rows || []).length, sent, gone });
});
