// Where the live app keeps its data. The publishable key is meant to sit in
// the app: on its own it opens nothing — every row is guarded by the
// database's access rules for the person signed in. The secret key never
// goes here.
export const SUPABASE_URL = 'https://tkgollbusscruzmedmdb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_5gPW-0j1WVz_yokKtMKmQg_Yg-84S_J';

// The preview build (the artifact) runs on sample data with no sign-in.
export const LIVE = import.meta.env.MODE !== 'preview';
