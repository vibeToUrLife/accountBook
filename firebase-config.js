export const firebaseConfig = {
  apiKey: "AIzaSyAw6j8O7f91vLHDBbTbA-m0x1wDyMcekRs",
  authDomain: "accountbook-6e296.firebaseapp.com",
  projectId: "accountbook-6e296",
  storageBucket: "accountbook-6e296.firebasestorage.app",
  messagingSenderId: "152621770538",
  appId: "1:152621770538:web:70fa2a7c530b76019fa053",
};

// Hosts where vercel.json proxies Firebase's sign-in helper (/__/auth/) through the
// site itself. There the iPhone home-screen app signs in through the site's own host
// (see js/auth-domain.js). Each host needs https://<host>/__/auth/handler among the
// "Authorized redirect URIs" of the Web OAuth client in Google Cloud Console.
export const sameSiteAuthHosts = ["accbook.vercel.app"];
