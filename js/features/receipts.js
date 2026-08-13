// Receipt photos feature module. Owns the pending-photo queue and the viewer
// state internally. Photos live in a per-transaction `receipts` subcollection;
// the transaction carries only a tiny `receiptCount`.
export function createReceipts(ctx) {
  const { icon, userCollections, firestore } = ctx;
  const { collection, doc, addDoc, getDocs, deleteDoc, setDoc, serverTimestamp, query, orderBy } = firestore;

  let pendingReceipts = [];   // dataURLs queued on the Add Record form
  let receiptViewerTxId = null;

  function receiptsCol(txId) {
    const { transactions: txCol } = userCollections(ctx.uid);
    return collection(doc(txCol, txId), "receipts");
  }

  // Resize to a max dimension and re-encode as JPEG to keep each image well under
  // Firestore's 1MB document limit.
  function compressImageToDataUrl(file, maxDim = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) { reject(new Error("Not an image")); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width >= height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
          else if (height > width && height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Image decode failed"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function filesToDataUrls(fileList) {
    const out = [];
    for (const file of Array.from(fileList || [])) {
      try { out.push(await compressImageToDataUrl(file)); } catch { /* skip non-image / failures */ }
    }
    return out;
  }

  async function saveReceiptsForTx(txId, dataUrls) {
    if (!dataUrls || !dataUrls.length) return;
    const col = receiptsCol(txId);
    for (const dataUrl of dataUrls) {
      await addDoc(col, { dataUrl, createdAt: serverTimestamp() });
    }
  }

  async function bumpReceiptCount(txId, delta) {
    const tx = ctx.transactions.find((t) => t.id === txId);
    const current = tx && typeof tx.receiptCount === "number" ? tx.receiptCount : 0;
    const { transactions: txCol } = userCollections(ctx.uid);
    await setDoc(doc(txCol, txId), { receiptCount: Math.max(0, current + delta) }, { merge: true });
  }

  function renderPendingReceipts() {
    const strip = document.getElementById("txReceiptPreview");
    if (!strip) return;
    strip.innerHTML = pendingReceipts.map((url, i) =>
      `<div class="receipt-thumb">
        <img src="${url}" alt="Pending photo ${i + 1}" data-action="view-pending" data-idx="${i}" />
        <button type="button" class="receipt-thumb-remove" data-action="remove-pending" data-idx="${i}" title="Remove" aria-label="Remove">${icon("x", "icon-sm")}</button>
      </div>`
    ).join("");
  }

  // --- Add Record form: pending photo queue ---
  async function queuePendingReceipts(fileList) {
    const urls = await filesToDataUrls(fileList);
    pendingReceipts.push(...urls);
    renderPendingReceipts();
  }

  function removePendingAt(idx) {
    pendingReceipts.splice(idx, 1);
    renderPendingReceipts();
  }

  function pendingCount() {
    return pendingReceipts.length;
  }

  // Save the queued photos to a newly-created transaction, then reset the queue/input.
  async function flushPendingTo(txId) {
    const queued = pendingReceipts.slice();
    if (queued.length) await saveReceiptsForTx(txId, queued);
    pendingReceipts = [];
    renderPendingReceipts();
    const input = document.getElementById("txReceiptInput");
    if (input) input.value = "";
  }

  // Cascade-delete a transaction's receipt subcollection.
  async function deleteAllForTx(txId) {
    const snap = await getDocs(receiptsCol(txId));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }

  // --- Viewer modal ---
  async function openReceiptViewer(txId) {
    receiptViewerTxId = txId;
    const modal = document.getElementById("receiptViewerModal");
    if (modal) modal.hidden = false;
    await refreshReceiptViewer();
  }

  function closeReceiptViewer() {
    receiptViewerTxId = null;
    const modal = document.getElementById("receiptViewerModal");
    if (modal) modal.hidden = true;
    const input = document.getElementById("receiptViewerAddInput");
    if (input) input.value = "";
  }

  async function refreshReceiptViewer() {
    const grid = document.getElementById("receiptViewerGrid");
    const status = document.getElementById("receiptViewerStatus");
    if (!grid || !receiptViewerTxId) return;
    grid.innerHTML = '<div class="muted small">Loading…</div>';
    let docs = [];
    try {
      const snap = await getDocs(query(receiptsCol(receiptViewerTxId), orderBy("createdAt", "asc")));
      docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { /* ignore */ }
    if (status) status.textContent = docs.length ? `${docs.length} photo${docs.length > 1 ? "s" : ""}` : "";
    if (!docs.length) { grid.innerHTML = '<div class="muted small">No photos yet. Add some above.</div>'; return; }
    grid.innerHTML = docs.map((r) =>
      `<div class="receipt-thumb">
        <img src="${r.dataUrl}" alt="Photo" data-action="view-receipt" />
        <button type="button" class="receipt-thumb-remove" data-action="delete-receipt" data-id="${r.id}" title="Delete" aria-label="Delete">${icon("x", "icon-sm")}</button>
      </div>`
    ).join("");
  }

  async function addReceiptsFromViewer(fileList) {
    if (!receiptViewerTxId) return;
    const status = document.getElementById("receiptViewerStatus");
    if (status) status.textContent = "Adding…";
    const urls = await filesToDataUrls(fileList);
    await saveReceiptsForTx(receiptViewerTxId, urls);
    await bumpReceiptCount(receiptViewerTxId, urls.length);
    await refreshReceiptViewer();
  }

  async function deleteReceiptFromViewer(receiptId) {
    if (!receiptViewerTxId) return;
    await deleteDoc(doc(receiptsCol(receiptViewerTxId), receiptId));
    await bumpReceiptCount(receiptViewerTxId, -1);
    await refreshReceiptViewer();
  }

  function openLightbox(src) {
    const box = document.getElementById("receiptLightbox");
    const img = document.getElementById("receiptLightboxImg");
    if (!box || !img) return;
    img.src = src;
    box.hidden = false;
  }

  function closeLightbox() {
    const box = document.getElementById("receiptLightbox");
    if (box) box.hidden = true;
  }

  return {
    queuePendingReceipts, removePendingAt, pendingCount, flushPendingTo, deleteAllForTx,
    openReceiptViewer, closeReceiptViewer, addReceiptsFromViewer, deleteReceiptFromViewer,
    openLightbox, closeLightbox,
  };
}
