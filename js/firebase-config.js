// ============================================================
// Firebase Configuration - 決戰邊際：奶茶大亨 (Marginal Tycoon)
// ============================================================
// ⚠️ IMPORTANT: Replace the config below with your own Firebase project settings.
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Enable Firestore Database (start in Test mode for classroom use)
// 4. Go to Project Settings → General → Your apps → Add web app
// 5. Copy the firebaseConfig object and paste below
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyByYwd5hQ05gjszTVmIJAdoFSc5P7GE0g8",
  authDomain: "marginal-tycoon.firebaseapp.com",
  projectId: "marginal-tycoon",
  storageBucket: "marginal-tycoon.firebasestorage.app",
  messagingSenderId: "369352582119",
  appId: "1:369352582119:web:a3a8b72dbc249ef191d342"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Helper: Generate a 4-digit game code
function generateGameCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
