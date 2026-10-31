// Firebase connection for BerzNi
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, getDocs, startAfter, doc, getDoc, setDoc, updateDoc, increment, where
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("الصورة يجب أن تكون JPG أو PNG أو WebP وألا يتجاوز حجمها 5 ميغابايت.");
    }
    let uploadFile = file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      if (scale < 1 || file.size > 700 * 1024) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressed = await new Promise((resolve, reject) => {
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر تجهيز الصورة.")), outputType, outputType === "image/jpeg" ? 0.82 : undefined);
        });
        const extension = outputType === "image/png" ? "png" : "jpg";
        uploadFile = new File([compressed], `berzni-image.${extension}`, { type: outputType });
      }
      bitmap.close();
    } catch (compressionError) {
      console.warn("Image compression skipped:", compressionError);
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("upload_preset", "berzni_upload");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("https://api.cloudinary.com/v1_1/wiq0fgyr/image/upload", { method: "POST", body: formData, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result.secure_url) {
        console.error("Cloudinary upload error:", result);
        throw new Error(result.error?.message || "فشل رفع الصورة إلى Cloudinary.");
      }
      return result.secure_url;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("استغرق رفع الصورة أكثر من 45 ثانية. تحقق من الإنترنت ثم أعد المحاولة.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
  createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  watchAuth: (callback) => onAuthStateChanged(auth, callback),
  getProfile: async () => { if (!auth.currentUser) throw new Error("سجّل الدخول أولاً."); const snap = await getDoc(doc(db, "users", auth.currentUser.uid)); return snap.exists() ? snap.data() : {}; },
  saveProfile: async (profile) => { if (!auth.currentUser) throw new Error("سجّل الدخول أولاً."); return setDoc(doc(db, "users", auth.currentUser.uid), { ...profile, email: auth.currentUser.email || "", updatedAt: serverTimestamp() }, { merge: true }); },
  publishListing: (item) => addDoc(collection(db, "listings"), { ...item, views: 0, ownerUid: auth.currentUser.uid, createdAt: serverTimestamp() }),\n  submitBusinessAd: (data) => { if (!auth.currentUser) throw new Error("سجّل الدخول أولاً."); return addDoc(collection(db, "businessAds"), { ...data, ownerUid: auth.currentUser.uid, status: "pending", createdAt: serverTimestamp() }); },\n  watchApprovedBusinessAds: (callback) => onSnapshot(query(collection(db, "businessAds"), where("status", "==", "approved")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn("Approved business ads:", err)),\n  watchBusinessRequests: (callback) => onSnapshot(query(collection(db, "businessAds"), where("status", "==", "pending"), orderBy("createdAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn("Business ad requests:", err)),\n  reviewBusinessAd: (id, status) => { if (!auth.currentUser || auth.currentUser.uid !== "9J2v3wl0QfTNx3SHGDp7DnYFvLd2") throw new Error("صلاحية المدير مطلوبة."); if (!["approved", "rejected"].includes(status)) throw new Error("حالة غير صالحة."); return updateDoc(doc(db, "businessAds", id), { status, reviewedAt: serverTimestamp() }); },
  recordListingView: async (id) => { const ref = doc(db, "listings", id); await updateDoc(ref, { views: increment(1) }); const snap = await getDoc(ref); return snap.exists() ? Math.max(0, Number(snap.data().views) || 0) : 0; },
  getListing: async (id) => { const snap = await getDoc(doc(db, "listings", id)); return snap.exists() ? { id: snap.id, ...snap.data() } : null; },
  watchListings: (callback, onError) => onSnapshot(
    query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(13)),
    async snapshot => {
      const removedIds = await Promise.all(snapshot.docChanges().filter(change => change.type === "removed").map(async change => {
        const current = await getDoc(change.doc.ref);
        return current.exists() ? null : change.doc.id;
      }));
      callback({
        items: snapshot.docs.slice(0, 12).map(doc => ({ id: doc.id, ...doc.data() })),
        removedIds: removedIds.filter(Boolean),
        lastDoc: snapshot.docs[Math.min(snapshot.docs.length, 12) - 1] || null,
        hasMore: snapshot.size > 12
      });
    },
    onError
  ),
  getMoreListings: async (lastDoc) => {
    if (!lastDoc) return { items: [], lastDoc: null, hasMore: false };
    const page = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(13)));
    const visibleDocs = page.docs.slice(0, 12);
    return {
      items: visibleDocs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: visibleDocs[visibleDocs.length - 1] || lastDoc,
      hasMore: page.size > 12
    };
  }
};

// ===== BerzNi: رفع آمن للصور =====
// ضع هذه الكتلة كما هي في firebase.js مباشرة قبل السطر:
//   document.dispatchEvent(new Event("berzni-firebase-ready"));
// لا تحذف أي شيء آخر. هذه الكتلة تستبدل uploadListingImage عند التشغيل.
(() => {
  const MAX_BYTES = 5 * 1024 * 1024;       // الحد الأقصى بعد المعالجة
  const MAX_INPUT_PIXELS = 40e6;           // حماية من الصور الضخمة (ذاكرة الهاتف)
  const CLOUD_NAME = "wiq0fgyr";
  const UPLOAD_PRESET = "berzni_upload";
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload";
  const URL_PREFIX = "https://res.cloudinary.com/" + CLOUD_NAME + "/";
  const TIMEOUT_MS = 45000;
  const ATTEMPTS = [
    { side: 1400, q: 0.78 }, { side: 1400, q: 0.65 }, { side: 1200, q: 0.55 },
    { side: 1000, q: 0.5 }, { side: 800, q: 0.45 }
  ];
  const fail = (m) => { throw new Error(m); };

  const readBytes = (blob) => typeof blob.arrayBuffer === "function"
    ? blob.arrayBuffer()
    : new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("read"));
        r.readAsArrayBuffer(blob);
      });
  const ascii = (b, from, to) => String.fromCharCode.apply(null, Array.from(b.slice(from, to)));

  // نوع الصورة الحقيقي من أول بايتات الملف (وليس من الامتداد أو file.type)
  const sniff = (b) => {
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
    if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return "image/png";
    if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
    return null;
  };
  const headOf = async (blob) => new Uint8Array(await readBytes(blob.slice(0, 16)));

  // فك ترميز حقيقي للصورة؛ أي فشل = رفض
  const decode = async (file) => {
    if (typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(file);
        return { src: bmp, w: bmp.width, h: bmp.height, free: () => { try { bmp.close(); } catch (e) {} } };
      } catch (e) { /* نجرب الطريقة البديلة أدناه */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await Promise.race([
        new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("decode")); }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("decode-timeout")), 15000))
      ]);
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, free: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  };

  const encode = (canvas, q) => new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", q);
  });

  // يتحقق من الصورة ويعيد ترميزها JPEG نظيفاً؛ أي فشل = رفض نهائي (لا رجوع للملف الأصلي)
  async function prepare(file) {
    if (!file || typeof file.size !== "number" || typeof file.slice !== "function") fail("لم يتم اختيار صورة صالحة.");
    if (file.size === 0) fail("الملف فارغ.");
    if (file.size > MAX_BYTES) fail("حجم الصورة يتجاوز 5 ميغابايت.");
    let real = null;
    try { real = sniff(await headOf(file)); } catch (e) { fail("تعذر قراءة الملف."); }
    if (!real) fail("الملف ليس صورة JPG أو PNG أو WebP حقيقية.");

    let img;
    try { img = await decode(file); } catch (e) { fail("تعذر فتح الصورة؛ قد يكون الملف تالفاً أو غير حقيقي."); }
    try {
      const w = img.w, h = img.h;
      if (!(w > 0 && h > 0)) fail("أبعاد الصورة غير صالحة.");
      if (w * h > MAX_INPUT_PIXELS) fail("أبعاد الصورة كبيرة جداً.");
      for (const a of ATTEMPTS) {
        const scale = Math.min(1, a.side / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) fail("تعذر تجهيز الصورة على هذا الجهاز.");
        ctx.fillStyle = "#ffffff";            // لتفادي الخلفية السوداء في صور PNG الشفافة
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img.src, 0, 0, cw, ch);
        let blob;
        try { blob = await encode(canvas, a.q); } catch (e) { fail("تعذر ضغط الصورة."); }
        canvas.width = 0; canvas.height = 0;
        let okType = false;
        try { okType = blob.type === "image/jpeg" && sniff(await headOf(blob)) === "image/jpeg"; } catch (e) {}
        if (!okType || !(blob.size > 0)) fail("تعذر ضغط الصورة بصيغة صالحة.");
        if (blob.size <= MAX_BYTES) return blob;
      }
      fail("تعذر خفض حجم الصورة إلى أقل من 5 ميغابايت.");
    } finally {
      img.free();
    }
  }

  async function upload(blob) {
    const formData = new FormData();
    formData.append("file", blob, "berzni-image.jpg");
    formData.append("upload_preset", UPLOAD_PRESET);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(UPLOAD_URL, { method: "POST", body: formData, signal: controller.signal });
      let result = null;
      try { result = await response.json(); } catch (e) {}
      if (!response.ok || !result || typeof result.secure_url !== "string") {
        console.error("Cloudinary upload error:", result);
        throw new Error((result && result.error && result.error.message) || "فشل رفع الصورة إلى Cloudinary.");
      }
      if (result.secure_url.indexOf(URL_PREFIX) !== 0) fail("ردّ غير متوقع من خدمة رفع الصور.");
      if (typeof result.bytes === "number" && result.bytes > MAX_BYTES) fail("حجم الصورة بعد الرفع يتجاوز 5 ميغابايت.");
      return result.secure_url;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("استغرق رفع الصورة أكثر من 45 ثانية. تحقق من الإنترنت ثم أعد المحاولة.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.berzniFirebase.uploadListingImage = async (file) => {
    if (!auth.currentUser) fail("يجب تسجيل الدخول أولاً.");
    const blob = await prepare(file);
    return upload(blob);
  };
})();

document.dispatchEvent(new Event("berzni-firebase-ready"));
console.info("BerzNi: Firebase initialized.");
