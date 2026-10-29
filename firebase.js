// Firebase connection for BerzNi
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
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
  createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  watchAuth: (callback) => onAuthStateChanged(auth, callback),
  publishListing: (item) => addDoc(collection(db, "listings"), {
    ...item, ownerUid: auth.currentUser.uid, createdAt: serverTimestamp()
  }),
  watchListings: (callback, onError) => onSnapshot(
    query(collection(db, "listings"), orderBy("createdAt", "desc")),
    snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
    onError
  )
};

document.dispatchEvent(new Event("berzni-firebase-ready"));
console.info("BerzNi: Firebase initialized.");
