// Where the live app keeps its data. The publishable key is meant to sit in
// the app: on its own it opens nothing — every row is guarded by the
// database's access rules for the person signed in. The secret key never
// goes here.
export const SUPABASE_URL = 'https://tkgollbusscruzmedmdb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_5gPW-0j1WVz_yokKtMKmQg_Yg-84S_J';

// The preview build (the artifact) runs on sample data with no sign-in.
export const LIVE = import.meta.env.MODE !== 'preview';

// Public half of the notification key pair; the private half lives only in
// Supabase's Edge Function secrets.
export const VAPID_PUBLIC_KEY = 'BB5OEq-DTIRqZaugywKF01oc26z5aAcQXmx9RcEervmt34gMvyNueL13LA-EtzSq1IusB1mq6f77JQbSn7FbXWU';
