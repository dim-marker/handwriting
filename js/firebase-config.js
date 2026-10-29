// Firebase SDK CDN üzərindən yükləndikdə istifadə olunacaq konfiqurasiya
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, push, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPk1kj3ATHRIQY6pQdnULwEu2gtzYpbu8",
  authDomain: "marker-base.firebaseapp.com",
  projectId: "marker-base",
  storageBucket: "marker-base.firebasestorage.app",
  messagingSenderId: "1051008092199",
  appId: "1:1051008092199:web:3d3a43c82cd00dafbfe602",
  measurementId: "G-HNL90J5R2M"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, get, set, push, update, onValue };
