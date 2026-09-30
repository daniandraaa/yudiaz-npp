/**
 * No Pusing Pusing (NPP) - Client Application Controller
 * Author: Devera (CTO & Lead Accountant)
 */

let state = {
  currentTab: "payout",
  partners: [],
  dailyBoard: null,
  transactions: [],
  fundingMode: "solo",
  selectedSoloPartnerId: 1,
  selectedPatunganPartners: new Set([1, 2]),
  patunganAmounts: {},
  inputAmount: 0,
  uploadedReceiptFilename: null,
  uploadedReceiptUrl: null,
};

function formatRupiah(num) {
  if (isNaN(num) || num === null || num === undefined) return "Rp 0";
  return "Rp " + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function showToast(message, isSuccess = true) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMsg");
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-3");
  }, 2600);
}

// ==================== TABS SWITCHER ====================
function switchTab(tab) {
  state.currentTab = tab;

  // Views
  const views = {
    payout: document.getElementById("viewPayout"),
    input: document.getElementById("viewInput"),
    list: document.getElementById("viewList"),
  };
  Object.keys(views).forEach(k => {
    if (views[k]) {
      if (k === tab) views[k].classList.remove("hidden");
      else views[k].classList.add("hidden");
    }
  });

  // Top Tab Buttons
  const tabBtns = {
    payout: document.getElementById("tabBtnPayout"),
    input: document.getElementById("tabBtnInput"),
    list: document.getElementById("tabBtnList"),
  };
  Object.keys(tabBtns).forEach(k => {
    const btn = tabBtns[k];
    if (btn) {
      if (k === tab) {
        btn.className = "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all bg-gold-500 text-obsidian-core shadow-[0_0_12px_rgba(234,179,8,0.3)]";
      } else {
        btn.className = "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all";
      }
    }
  });

  // Bottom Mobile Dock Buttons
  const dockBtns = {
    payout: document.getElementById("dockBtnPayout"),
    input: document.getElementById("dockBtnInput"),
    list: document.getElementById("dockBtnList"),
  };
  Object.keys(dockBtns).forEach(k => {
    const btn = dockBtns[k];
    if (btn && k !== "input") {
      btn.className = k === tab 
        ? "flex flex-col items-center gap-1 text-[10px] font-semibold text-gold-400"
        : "flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white";
    }
  });

  if (window.lucide) lucide.createIcons();
}

// ==================== DATA FETCHING ====================
async function loadAllData() {
  try {
    const refreshIcon = document.getElementById("refreshIcon");
    if (refreshIcon) refreshIcon.classList.add("animate-spin");

    // 1. Fetch Partners
    const pRes = await fetch("/api/v1/partners");
    const pData = await pRes.json();
    if (pData.success) {
      state.partners = pData.data;
      renderSoloButtons();
      renderPatunganRows();
    }

    // 2. Fetch Board
    const bRes = await fetch("/api/v1/board");
    const bData = await bRes.json();
    if (bData.success) {
      state.dailyBoard = bData.data;
      renderDailyBoard();
    }

    // 3. Fetch Transactions
    const tRes = await fetch("/api/v1/transactions");
    const tData = await tRes.json();
    if (tData.success) {
      state.transactions = tData.data;
      renderTransactionsList();
    }

    if (refreshIcon) setTimeout(() => refreshIcon.classList.remove("animate-spin"), 400);
  } catch (err) {
    console.error("Failed loading data:", err);
    showToast("Gagal menyambung ke server", false);
  }
}

function refreshData() {
  loadAllData();
  showToast("Data berhasil diperbarui");
}

// ==================== RENDER BOARD ====================
function renderDailyBoard() {
  const board = state.dailyBoard;
  if (!board) return;

  // Header stats
  document.getElementById("currentDateDisplay").textContent = `Tanggal: ${board.day_date}`;
  const badge = document.getElementById("sessionStatusBadge");
  if (badge) {
    if (board.status === "ACTIVE") {
      badge.textContent = "SESI AKTIF";
      badge.className = "font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
    } else {
      badge.textContent = "BUKU DITUTUP";
      badge.className = "font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30";
    }
  }

  document.getElementById("heroTotalCapital").textContent = formatRupiah(board.total_capital);
  document.getElementById("heroTotalTrx").textContent = `${board.total_transactions} trx`;

  // Count settled
  const settledCount = board.payouts.filter(p => p.is_taken || p.total_modal === 0).length;
  document.getElementById("heroSettledCount").textContent = `${settledCount} / 7 Lunas`;

  // Calculate percentage of settled money
  let settledMoney = 0;
  board.payouts.forEach(p => {
    if (p.is_taken) settledMoney += p.total_modal;
  });
  const pct = board.total_capital > 0 ? Math.round((settledMoney / board.total_capital) * 100) : 0;
  document.getElementById("settlementPercentText").textContent = `${pct}% (${formatRupiah(settledMoney)})`;
  document.getElementById("settlementProgressBar").style.width = `${pct}%`;

  // Render Payout Cards Grid
  const grid = document.getElementById("payoutCardsGrid");
  if (!grid) return;

  grid.innerHTML = board.payouts.map(po => {
    const isZero = po.total_modal === 0;
    const isTaken = po.is_taken;
    
    // Status visual styles
    let cardBorder = "border-obsidian-border";
    let statusBadge = "";
    let btnAction = "";

    if (isZero) {
      statusBadge = `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">TIDAK ADA MODAL</span>`;
      btnAction = `<div class="text-[11px] font-mono text-slate-500 italic py-1">Tidak keluar modal hari ini</div>`;
    } else if (isTaken) {
      cardBorder = "border-emerald-500/40 bg-emerald-950/20";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><i data-lucide="check-check" class="w-3 h-3"></i> LUNAS AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, false)" class="w-full py-2 px-3 rounded-xl bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border text-slate-300 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors">
          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-slate-400"></i>
          <span>Ubah ke Belum Ambil</span>
        </button>
      `;
    } else {
      cardBorder = "border-gold-500/40 bg-obsidian-card shadow-[0_0_15px_rgba(234,179,8,0.08)]";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"><i data-lucide="clock" class="w-3 h-3"></i> WAJIB AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, true)" class="w-full py-2.5 px-3 rounded-xl gold-gradient-bg text-obsidian-core font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.3)] active:scale-[0.98] transition-all">
          <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
          <span>SUDAH AMBIL CASH ✓</span>
        </button>
      `;
    }

    const itemsCountText = po.transaction_count > 0 ? `${po.transaction_count} transaksi` : "0 transaksi";

    return `
      <article class="rounded-2xl p-4 border ${cardBorder} transition-all duration-300 relative flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shadow-md" style="background-color: ${po.color}25; color: ${po.color}; border: 1px solid ${po.color}50;">
                ${po.initials}
              </div>
              <div>
                <h3 class="text-sm font-bold text-white font-sans">${po.name}</h3>
                <span class="text-[10px] font-mono text-slate-400">${itemsCountText}</span>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="my-2.5 p-3 rounded-xl bg-obsidian-surface/80 border border-obsidian-border">
            <div class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Modal Yang Ditarik:</div>
            <div class="text-xl font-mono font-extrabold ${isTaken ? 'text-emerald-400' : 'text-gold-400'} mt-0.5">
              ${formatRupiah(po.total_modal)}
            </div>
          </div>
        </div>

        <div>
          ${btnAction}
        </div>
      </article>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

async function togglePayout(partnerId, isTaken) {
  try {
    const res = await fetch("/api/v1/payout/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_id: partnerId, is_taken: isTaken })
    });
    const data = await res.json();
    if (data.success) {
      loadAllData();
      showToast(isTaken ? "Status: Modal sudah diambil cash ✓" : "Status diubah ke belum diambil");
    }
  } catch (err) {
    showToast("Gagal memperbarui status", false);
  }
}

// ==================== SOLO & PATUNGAN INPUT MODES ====================
function setFundingMode(mode) {
  state.fundingMode = mode;
  const btnSolo = document.getElementById("btnModeSolo");
  const btnPatungan = document.getElementById("btnModePatungan");
  const containerSolo = document.getElementById("soloModeContainer");
  const containerPatungan = document.getElementById("patunganModeContainer");

  if (mode === "solo") {
    btnSolo.className = "px-2.5 py-1 rounded bg-gold-500 text-obsidian-core font-bold transition-all";
    btnPatungan.className = "px-2.5 py-1 rounded text-slate-400 hover:text-white transition-all";
    containerSolo.classList.remove("hidden");
    containerPatungan.classList.add("hidden");
  } else {
    btnSolo.className = "px-2.5 py-1 rounded text-slate-400 hover:text-white transition-all";
    btnPatungan.className = "px-2.5 py-1 rounded bg-gold-500 text-obsidian-core font-bold transition-all";
    containerSolo.classList.add("hidden");
    containerPatungan.classList.remove("hidden");
    autoSplitEvenly();
  }
}

function renderSoloButtons() {
  const container = document.getElementById("soloPartnerButtons");
  if (!container) return;

  container.innerHTML = state.partners.map(p => {
    const isSelected = p.id === state.selectedSoloPartnerId;
    const activeClass = isSelected
      ? "border-gold-500 bg-gold-500/15 text-gold-400 shadow-[0_0_12px_rgba(234,179,8,0.25)] ring-1 ring-gold-500"
      : "border-obsidian-border bg-obsidian-surface text-slate-300 hover:border-slate-500";

    return `
      <button type="button" onclick="selectSoloPartner(${p.id})" class="p-3 rounded-xl border ${activeClass} flex items-center gap-2.5 text-left transition-all">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs" style="background-color: ${p.color}25; color: ${p.color}; border: 1px solid ${p.color}40;">
          ${p.initials}
        </div>
        <div class="truncate min-w-0">
          <div class="text-xs font-bold truncate">${p.name}</div>
          <div class="text-[9px] font-mono text-slate-400">100% Modal</div>
        </div>
      </button>
    `;
  }).join("");
}

function selectSoloPartner(id) {
  state.selectedSoloPartnerId = id;
  renderSoloButtons();
}

function renderPatunganRows() {
  const container = document.getElementById("patunganPartnerRows");
  if (!container) return;

  container.innerHTML = state.partners.map(p => {
    const isChecked = state.selectedPatunganPartners.has(p.id);
    const amountVal = state.patunganAmounts[p.id] || 0;

    return `
      <div class="flex items-center gap-2.5 p-2 rounded-xl bg-obsidian-surface border ${isChecked ? 'border-gold-500/40 bg-gold-500/5' : 'border-obsidian-border'} transition-colors">
        <label class="flex items-center gap-2 cursor-pointer shrink-0">
          <input type="checkbox" onchange="togglePatunganPartner(${p.id}, this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-gold-500 focus:ring-0 accent-gold-500 cursor-pointer">
          <div class="w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold" style="background-color: ${p.color}25; color: ${p.color};">
            ${p.initials}
          </div>
          <span class="text-xs font-bold text-white w-24 sm:w-28 truncate">${p.name}</span>
        </label>

        <div class="flex-1 relative">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">Rp</span>
          <input type="number" value="${amountVal}" ${!isChecked ? 'disabled' : ''} oninput="setPartnerAmount(${p.id}, this.value)" class="w-full bg-obsidian-card border border-obsidian-border rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-gold-500 disabled:opacity-40 disabled:cursor-not-allowed">
        </div>
      </div>
    `;
  }).join("");

  updateUnallocatedCalculation();
}

function togglePatunganPartner(id, checked) {
  if (checked) {
    state.selectedPatunganPartners.add(id);
  } else {
    state.selectedPatunganPartners.delete(id);
    delete state.patunganAmounts[id];
  }
  autoSplitEvenly();
  renderPatunganRows();
}

function setPartnerAmount(id, value) {
  const val = parseFloat(value) || 0;
  state.patunganAmounts[id] = val;
  updateUnallocatedCalculation();
}

function autoSplitEvenly() {
  const count = state.selectedPatunganPartners.size;
  if (count === 0 || state.inputAmount <= 0) return;

  const perPerson = Math.floor(state.inputAmount / count);
  const remainder = state.inputAmount - (perPerson * count);

  let idx = 0;
  state.selectedPatunganPartners.forEach(pid => {
    state.patunganAmounts[pid] = perPerson + (idx === 0 ? remainder : 0);
    idx++;
  });

  renderPatunganRows();
}

function updateUnallocatedCalculation() {
  const display = document.getElementById("unallocatedDisplay");
  if (!display) return;

  let totalAllocated = 0;
  state.selectedPatunganPartners.forEach(pid => {
    totalAllocated += (state.patunganAmounts[pid] || 0);
  });

  const diff = state.inputAmount - totalAllocated;
  if (Math.abs(diff) < 1) {
    display.textContent = "Rp 0 (Pas)";
    display.className = "font-bold text-emerald-400";
  } else if (diff > 0) {
    display.textContent = `Kurang ${formatRupiah(diff)}`;
    display.className = "font-bold text-amber-400";
  } else {
    display.textContent = `Lebih ${formatRupiah(Math.abs(diff))}`;
    display.className = "font-bold text-rose-400";
  }
}

// Amount Shortcuts
function handleAmountInput(val) {
  state.inputAmount = parseFloat(val) || 0;
  if (state.fundingMode === "patungan") {
    autoSplitEvenly();
  }
}

function addAmount(delta) {
  state.inputAmount += delta;
  document.getElementById("inputTotalAmount").value = state.inputAmount;
  if (state.fundingMode === "patungan") {
    autoSplitEvenly();
  }
}

function clearAmount() {
  state.inputAmount = 0;
  document.getElementById("inputTotalAmount").value = "";
  state.patunganAmounts = {};
  renderPatunganRows();
}

// ==================== SUBMIT TRANSACTION ====================
// ==================== RECEIPT AI OCR UPLOAD ====================
async function handleReceiptUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const promptEl = document.getElementById("receiptPrompt");
  const loadingEl = document.getElementById("receiptLoading");
  const previewEl = document.getElementById("receiptPreviewBox");
  const badgeEl = document.getElementById("ocrStatusBadge");

  // Show loading state
  if (promptEl) promptEl.classList.add("hidden");
  if (previewEl) previewEl.classList.add("hidden");
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (badgeEl) {
    badgeEl.textContent = "AI Memindai...";
    badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse";
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/v1/ocr-receipt", {
      method: "POST",
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      state.uploadedReceiptFilename = result.receipt_filename;
      state.uploadedReceiptUrl = result.receipt_url;

      // Update thumbnail and preview title
      const thumb = document.getElementById("receiptThumbnail");
      if (thumb) thumb.src = result.receipt_url;

      const titleEl = document.getElementById("receiptPreviewTitle");
      if (titleEl) titleEl.textContent = result.item_name || file.name;

      const infoEl = document.getElementById("receiptPreviewInfo");
      if (infoEl) infoEl.textContent = result.total_amount > 0 ? `✓ Terdeteksi ${formatRupiah(result.total_amount)}` : "✓ Foto tersimpan (Isi nominal)";

      // Auto-fill form inputs
      if (result.total_amount > 0) {
        const amountInput = document.getElementById("inputTotalAmount");
        if (amountInput) {
          amountInput.value = result.total_amount;
          handleAmountInput(result.total_amount);
          // Highlight flash animation
          amountInput.classList.add("border-gold-400", "bg-gold-500/10");
          setTimeout(() => amountInput.classList.remove("border-gold-400", "bg-gold-500/10"), 1500);
        }
      }

      if (result.item_name && result.item_name !== "Emas") {
        const itemInput = document.getElementById("inputItemName");
        if (itemInput) itemInput.value = result.item_name;
      }

      if (result.notes) {
        const notesInput = document.getElementById("inputNotes");
        if (notesInput) notesInput.value = result.notes;
      }

      if (badgeEl) {
        badgeEl.textContent = "✓ Terisi Otomatis";
        badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      }

      showToast(`Struk dipindai! Nominal ${formatRupiah(result.total_amount)} otomatis terisi.`);
    } else {
      showToast("Gagal memindai nota", false);
    }
  } catch (err) {
    showToast("Kendala memproses gambar struk", false);
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (state.uploadedReceiptFilename) {
      if (previewEl) previewEl.classList.remove("hidden");
    } else {
      if (promptEl) promptEl.classList.remove("hidden");
    }
    if (window.lucide) lucide.createIcons();
  }
}

function clearReceiptUpload() {
  state.uploadedReceiptFilename = null;
  state.uploadedReceiptUrl = null;

  const fileInput = document.getElementById("receiptFileInput");
  if (fileInput) fileInput.value = "";

  const promptEl = document.getElementById("receiptPrompt");
  const loadingEl = document.getElementById("receiptLoading");
  const previewEl = document.getElementById("receiptPreviewBox");
  const badgeEl = document.getElementById("ocrStatusBadge");

  if (loadingEl) loadingEl.classList.add("hidden");
  if (previewEl) previewEl.classList.add("hidden");
  if (promptEl) promptEl.classList.remove("hidden");
  if (badgeEl) {
    badgeEl.textContent = "Auto-Fill Form";
    badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30";
  }
}

function openReceiptModal(url) {
  const modal = document.getElementById("receiptModal");
  const img = document.getElementById("receiptModalImg");
  if (!modal || !img) return;
  img.src = url;
  modal.classList.remove("hidden");
}

function closeReceiptModal() {
  const modal = document.getElementById("receiptModal");
  if (modal) modal.classList.add("hidden");
}

async function submitTransaction() {
  if (state.inputAmount <= 0) {
    showToast("Nominal pembelian belum diisi!", false);
    document.getElementById("inputTotalAmount").focus();
    return;
  }

  const itemName = document.getElementById("inputItemName").value.trim();
  const notes = document.getElementById("inputNotes").value.trim();

  let shares = [];
  if (state.fundingMode === "solo") {
    shares.push({
      partner_id: state.selectedSoloPartnerId,
      amount: state.inputAmount
    });
  } else {
    let sumPatungan = 0;
    state.selectedPatunganPartners.forEach(pid => {
      const amt = state.patunganAmounts[pid] || 0;
      if (amt > 0) {
        shares.push({ partner_id: pid, amount: amt });
        sumPatungan += amt;
      }
    });

    if (Math.abs(sumPatungan - state.inputAmount) > 1) {
      showToast(`Total alokasi (${formatRupiah(sumPatungan)}) tidak sama dengan harga beli!`, false);
      return;
    }
  }

  const payload = {
    item_name: itemName || undefined,
    total_amount: state.inputAmount,
    shares: shares,
    notes: notes || undefined,
    receipt_image: state.uploadedReceiptFilename || undefined
  };

  try {
    const btn = document.getElementById("btnSubmitTrx");
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Menyimpan...</span>`;

    const res = await fetch("/api/v1/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast("Transaksi pembelian berhasil dicatat!");
      clearAmount();
      clearReceiptUpload();
      document.getElementById("inputItemName").value = "";
      document.getElementById("inputNotes").value = "";
      await loadAllData();
      switchTab("payout"); // Auto switch to Payout board to see immediate updated modal
    } else {
      showToast(data.detail || "Gagal menyimpan", false);
    }
  } catch (err) {
    showToast("Terjadi kendala jaringan", false);
  } finally {
    const btn = document.getElementById("btnSubmitTrx");
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5"></i><span>Simpan Transaksi Pembelian</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

// ==================== TRANSACTIONS LIST ====================
function renderTransactionsList() {
  const container = document.getElementById("txListContainer");
  const badge = document.getElementById("txCountBadge");
  if (!container) return;

  const list = state.transactions || [];
  if (badge) badge.textContent = `${list.length} Transaksi`;

  if (list.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-slate-500 text-xs">Belum ada transaksi pembelian hari ini.</div>`;
    return;
  }

  container.innerHTML = list.map(tx => {
    const sharesHtml = tx.shares.map(s => `
      <span class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-obsidian-surface border border-obsidian-border">
        <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${s.partner_color}"></span>
        <span class="font-bold text-white">${s.partner_name}</span>: ${formatRupiah(s.amount)} (${s.percentage}%)
      </span>
    `).join(" ");

    return `
      <article class="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-white">${tx.item_name}</h4>
              <span class="text-[9px] font-mono text-slate-400">${tx.created_at.substring(11, 16)} WIB</span>
            </div>
            ${tx.notes ? `<p class="text-[11px] text-slate-400 mt-0.5">${tx.notes}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            ${tx.receipt_image ? `
              <button onclick="openReceiptModal('/api/v1/receipts/${tx.receipt_image}')" class="text-[10px] font-mono font-bold text-gold-400 hover:text-white px-2 py-1 rounded-lg bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 flex items-center gap-1 transition-all shadow-sm">
                <i data-lucide="image" class="w-3 h-3 text-gold-400"></i>
                <span>Nota</span>
              </button>
            ` : ''}
            <span class="text-xs font-mono font-extrabold text-gold-400">${formatRupiah(tx.total_amount)}</span>
            <button onclick="deleteTransaction('${tx.id}')" class="text-slate-500 hover:text-rose-400 p-1" title="Hapus Transaksi">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1 border-t border-obsidian-border/50">
          ${sharesHtml}
        </div>
      </article>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

async function deleteTransaction(id) {
  if (!confirm("Hapus transaksi pembelian ini? Modal para partner akan disesuaikan otomatis.")) return;

  try {
    const res = await fetch(`/api/v1/transactions/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Transaksi berhasil dihapus");
      loadAllData();
    }
  } catch (err) {
    showToast("Gagal menghapus transaksi", false);
  }
}

// ==================== WHATSAPP SHARE ====================
function copyWhatsAppRekap() {
  if (!state.dailyBoard || !state.dailyBoard.whatsapp_rekap) {
    showToast("Data rekap belum siap", false);
    return;
  }

  const text = state.dailyBoard.whatsapp_rekap;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Rekap WA berhasil disalin ke clipboard! Siap kirim ke grup.");
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast("Rekap WA berhasil disalin ke clipboard!");
}

// ==================== CLOSE & REOPEN SESSIONS ====================
async function promptCloseSession() {
  const isAll = state.dailyBoard && state.dailyBoard.all_settled;
  const msg = isAll 
    ? "Tutup buku sesi hari ini? Seluruh modal partner sudah lunas ditarik."
    : "PERHATIAN: Masih ada pemodal yang belum mencentang ambil cash. Yakin ingin menutup buku?";
  
  if (!confirm(msg)) return;

  try {
    const res = await fetch("/api/v1/day/close", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      loadAllData();
    }
  } catch (err) {
    showToast("Gagal menutup sesi", false);
  }
}

// ==================== SETTINGS (PARTNER NAMES) ====================
function openSettingsModal() {
  const modal = document.getElementById("modalSettings");
  const container = document.getElementById("settingsPartnersList");
  if (!modal || !container) return;

  container.innerHTML = state.partners.map(p => `
    <div class="flex items-center gap-2">
      <span class="text-xs font-mono font-bold text-slate-400 w-5">#${p.id}</span>
      <input type="text" id="partnerNameInput_${p.id}" value="${p.name}" class="flex-1 bg-obsidian-surface border border-obsidian-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-500 font-bold">
    </div>
  `).join("");

  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
  const modal = document.getElementById("modalSettings");
  if (modal) modal.classList.add("hidden");
}

async function saveAllPartnerSettings() {
  try {
    for (const p of state.partners) {
      const input = document.getElementById(`partnerNameInput_${p.id}`);
      if (input && input.value.trim() && input.value.trim() !== p.name) {
        await fetch(`/api/v1/partners/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.value.trim() })
        });
      }
    }
    closeSettingsModal();
    showToast("Nama-nama pemodal berhasil diperbarui!");
    loadAllData();
  } catch (err) {
    showToast("Gagal menyimpan nama pemodal", false);
  }
}

// Boot application
window.addEventListener("DOMContentLoaded", () => {
  loadAllData();
  if (window.lucide) lucide.createIcons();
});
