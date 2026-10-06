// KAMWENGE LIVE™ Firebase web configuration

export const firebaseConfig = {
  apiKey: "AIzaSyCS3874WURWPcxzzLd9dFWf9YNJousH8oE",
  authDomain: "kamwenge-live.firebaseapp.com",
  projectId: "kamwenge-live",
  storageBucket: "kamwenge-live.firebasestorage.app",
  messagingSenderId: "1026868691597",
  appId: "1:1026868691597:web:c71bb1b6a688b4c819d8c4",
  measurementId: "G-J0TQFSKBLS"
};

// Used by Kamwenge Live to check whether Firebase
// has been configured before running authentication/database code.
export const firebaseConfigured = !Object.values(firebaseConfig).some(
  value => String(value).includes("PASTE_")
);