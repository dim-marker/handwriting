// Firebase SDK CDN üzərindən yükləndikdə istifadə olunacaq konfiqurasiya
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, push, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqiyZq7ML-X0VmWjuk1S4IXWzBVe2-BVs",
  authDomain: "sagird-yoxlama-sistemi.firebaseapp.com",
  databaseURL: "https://sagird-yoxlama-sistemi-default-rtdb.firebaseio.com",
  projectId: "sagird-yoxlama-sistemi",
  storageBucket: "sagird-yoxlama-sistemi.firebasestorage.app",
  messagingSenderId: "954607993567",
  appId: "1:954607993567:web:85c2111855ac65068d1f6a",
  measurementId: "G-8N39RBNSJW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, get, set, push, update, onValue };
