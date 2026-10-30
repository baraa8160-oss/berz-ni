// Owner-only listing actions for BerzNi
import { doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

function attachListingActions() {
  const fb = window.berzniFirebase;
  if (!fb || fb.updateListing) return;
  fb.updateListing = (id, item) => updateDoc(doc(fb.db, "listings", id), item);
  fb.deleteListing = (id) => deleteDoc(doc(fb.db, "listings", id));
}
document.addEventListener("berzni-firebase-ready", attachListingActions);
if (window.berzniFirebase) attachListingActions();
