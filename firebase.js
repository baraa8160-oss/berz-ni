// Firebase connection for BerzNi
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, getDocs, startAfter
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

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
const storage = getStorage(app);

window.berzniFirebase = {
  app, auth, db,
  uploadListingImage: async (file) => {
    if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("الصورة يجب أن تكون JPG أو PNG أو WebP وألا يتجاوز حجمها 5 ميغابايت.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const imageRef = ref(storage, `listings/${auth.currentUser.uid}/${Date.now()}_${safeName}`);
    await uploadBytes(imageRef, file, { contentType: file.type });
    return await getDownloadURL(imageRef);
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
