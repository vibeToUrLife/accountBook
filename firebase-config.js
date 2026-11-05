export const firebaseConfig = {
  apiKey: "AIzaSyAw6j8O7f91vLHDBbTbA-m0x1wDyMcekRs",
  authDomain: "accountbook-6e296.firebaseapp.com",
  projectId: "accountbook-6e296",
  storageBucket: "accountbook-6e296.firebasestorage.app",
  messagingSenderId: "152621770538",
  appId: "1:152621770538:web:70fa2a7c530b76019fa053",
};

// Google sign-in in the iPhone home-screen app goes to Google directly (see
// js/google-signin.js) with this OAuth client, the "Web client (auto created by Google
// Service)" that Firebase's Google sign-in uses (an ID, not a secret). It comes back to
// https://<host>/__/auth/handler, so it is used only on these hosts, and each must have
// that address among the client's "Authorized redirect URIs" in Google Cloud Console.
export const googleWebClientId = "152621770538-uq82t2jcpt5dghp2nudr8qeen7o4ubtc.apps.googleusercontent.com";
export const googleRedirectHosts = ["accbook.vercel.app"];
