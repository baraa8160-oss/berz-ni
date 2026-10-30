// Firebase connection for BerzNi
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, getDocs, startAfter
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4mYC2iZZCaJQezHPnauL7yaT-4EdCBXs",
  authDomain: "berzni-fe056.firebaseapp.com",
  projectId: "berzni-fe056",
  storageBucket: "berzni-fe056.firebasestorage.app",
  messagingSenderId: "975312495828",
  appId: "1:975312495828:web:f08e897906a64056880741"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.berzniFirebase = {
  app, auth, db,
  uploadListingImage: async (file) => {
    if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("الصورة يجب أن تكون JPG أو PNG أو WebP وألا يتجاوز حجمها 5 ميغابايت.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "berzni_upload");
    const response = await fetch("https://api.cloudinary.com/v1_1/wiq0fgyr/image/upload", {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    if (!response.ok || !result.secure_url) {
      console.error("Cloudinary upload error:", result);
      throw new Error(result.error?.message || "فشل رفع الصورة إلى Cloudinary.");
    }
    return result.secure_url;
  },
  createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  watchAuth: (callback) => onAuthStateChanged(auth, callback),
  publishListing: (item) => addDoc(collection(db, "listings"), {
    ...item, ownerUid: auth.currentUser.uid, createdAt: serverTimestamp()
  }),
  watchListings: (callback, onError) => onSnapshot(
    query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(12)),
    snapshot => callback({
      items: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.size === 12
    }),
    onError
  ),
  getMoreListings: async (lastDoc) => {
    if (!lastDoc) return { items: [], lastDoc: null, hasMore: false };
    const page = await getDocs(query(
      collection(db, "listings"),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(12)
    ));
    return {
      items: page.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: page.docs[page.docs.length - 1] || lastDoc,
      hasMore: page.size === 12
    };
  }
};

document.dispatchEvent(new Event("berzni-firebase-ready"));
console.info("BerzNi: Firebase initialized.");
