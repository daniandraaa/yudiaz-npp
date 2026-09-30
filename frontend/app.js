/**
 * Beli Emas Makassar — No Pusing Pusing (NPP)
 * Client Application Controller
 * Author: Devera (CTO & Lead Accountant)
 */

let state = {
  currentTab: "payout",
  partners: [],
  dailyBoard: null,
  transactions: [],
  historyList: [],
  selectedHistoryBoard: null,
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
  const iconEl = document.getElementById("toastIcon");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  if (iconEl) {
    iconEl.setAttribute("data-lucide", isSuccess ? "check-circle" : "alert-circle");
    iconEl.className = isSuccess ? "w-4 h-4 text-gold-400" : "w-4 h-4 text-rose-400";
    if (window.lucide) lucide.createIcons();
  }

  toast.classList.remove("opacity-0", "translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-3");
  }, 2800);
}

// ==================== TABS SWITCHER ====================
function switchTab(tab) {
  state.currentTab = tab;

  // Views
  const views = {
    payout: document.getElementById("viewPayout"),
    input: document.getElementById("viewInput"),
    list: document.getElementById("viewList"),
    history: document.getElementById("viewHistory"),
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
    history: document.getElementById("tabBtnHistory"),
  };
  Object.keys(tabBtns).forEach(k => {
    const btn = tabBtns[k];
    if (btn) {
      if (k === tab) {
        btn.className = "flex items-center justify-center gap-1.5 py-2.5 px-1 sm:px-3 rounded-xl text-xs font-bold transition-all gold-gradient-bg text-maroon-950 shadow-[0_0_15px_rgba(212,175,55,0.35)]";
      } else {
        btn.className = "flex items-center justify-center gap-1.5 py-2.5 px-1 sm:px-3 rounded-xl text-xs font-bold text-slate-300 hover:text-gold-300 hover:bg-maroon-850/60 transition-all";
      }
    }
  });

  // Bottom Mobile Dock Buttons
  const dockBtns = {
    payout: document.getElementById("dockBtnPayout"),
    input: document.getElementById("dockBtnInput"),
    list: document.getElementById("dockBtnList"),
    history: document.getElementById("dockBtnHistory"),
  };
  Object.keys(dockBtns).forEach(k => {
    const btn = dockBtns[k];
    if (btn && k !== "input") {
      btn.className = k === tab 
        ? "flex flex-col items-center gap-1 text-[10px] font-bold text-gold-400"
        : "flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white";
    }
  });

  if (tab === "history") {
    loadHistoryData();
  }

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

    // 2. Fetch Board (Active session)
    const bRes = await fetch("/api/v1/board");
    const bData = await bRes.json();
    if (bData.success) {
      state.dailyBoard = bData.data;
      renderDailyBoard();
    }

    // 3. Fetch Transactions (Active session)
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

  const isClosed = board.status === "CLOSED";

  // Header stats
  const dateLabel = board.display_name || `Tanggal: ${board.day_date}`;
  document.getElementById("currentDateDisplay").textContent = dateLabel;

  const dot = document.getElementById("sessionIndicatorDot");
  if (dot) {
    if (isClosed) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]";
    } else {
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse";
    }
  }

  const badge = document.getElementById("sessionStatusBadge");
  if (badge) {
    if (isClosed) {
      badge.textContent = "BUKU DITUTUP";
      badge.className = "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40";
    } else {
      badge.textContent = "SESI AKTIF";
      badge.className = "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/35";
    }
  }

  // Toggle Buka Buku Banner
  const closedBanner = document.getElementById("bookClosedBanner");
  if (closedBanner) {
    if (isClosed) {
      closedBanner.classList.remove("hidden");
    } else {
      closedBanner.classList.add("hidden");
    }
  }

  // Form Catat Beli states
  const formWarning = document.getElementById("closedWarningInForm");
  const formContainer = document.getElementById("formCatatBeliContainer");
  if (formWarning && formContainer) {
    if (isClosed) {
      formWarning.classList.remove("hidden");
      formContainer.classList.add("opacity-40", "pointer-events-none");
    } else {
      formWarning.classList.add("hidden");
      formContainer.classList.remove("opacity-40", "pointer-events-none");
    }
  }

  // Main session toggle button in Ambil Modal tab
  const toggleBtn = document.getElementById("mainSessionToggleBtn");
  const toggleText = document.getElementById("mainSessionToggleText");
  const toggleIcon = document.getElementById("mainSessionToggleIcon");
  if (toggleBtn && toggleText) {
    if (isClosed) {
      toggleBtn.className = "py-3.5 px-4 rounded-xl gold-gradient-bg gold-gradient-bg-hover text-maroon-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-all active:scale-[0.98]";
      toggleText.textContent = "Buka Buku Baru";
      if (toggleIcon) toggleIcon.setAttribute("data-lucide", "book-open");
    } else {
      toggleBtn.className = "py-3 px-4 rounded-xl bg-maroon-900 hover:bg-maroon-800 border border-gold-500/30 text-amber-100/80 hover:text-white font-mono text-xs flex items-center justify-center gap-2 transition-all";
      toggleText.textContent = "Tutup Buku Hari Ini";
      if (toggleIcon) toggleIcon.setAttribute("data-lucide", "lock");
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
    
    // Status visual styles matching Royal Burgundy & Gold Luxury
    let cardBorder = "border-maroon-700/70 bg-maroon-900/60";
    let statusBadge = "";
    let btnAction = "";

    if (isZero) {
      statusBadge = `<span class="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-maroon-950 text-slate-400 border border-maroon-700">TIDAK ADA MODAL</span>`;
      btnAction = `<div class="text-[11px] font-mono text-slate-500 italic py-1 text-center">Tidak keluar modal sesi ini</div>`;
    } else if (isTaken) {
      cardBorder = "border-emerald-500/40 bg-gradient-to-b from-maroon-900/90 to-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/35"><i data-lucide="check-check" class="w-3 h-3"></i> LUNAS AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, false)" class="w-full py-2.5 px-3 rounded-xl bg-maroon-850 hover:bg-maroon-800 border border-maroon-700 text-slate-300 hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 transition-colors">
          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-slate-400"></i>
          <span>Ubah ke Belum Ambil</span>
        </button>
      `;
    } else {
      cardBorder = "border-gold-500/50 bg-gradient-to-b from-maroon-850 to-maroon-900 shadow-[0_0_20px_rgba(212,175,55,0.14)] ring-1 ring-gold-500/30";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/40 animate-pulse"><i data-lucide="clock" class="w-3 h-3 text-gold-400"></i> WAJIB AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, true)" class="w-full py-2.5 px-3 rounded-xl gold-gradient-bg gold-gradient-bg-hover text-maroon-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(212,175,55,0.35)] active:scale-[0.98] transition-all">
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
              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shadow-md shrink-0" style="background-color: ${po.color}25; color: ${po.color}; border: 1.5px solid ${po.color}60;">
                ${po.initials}
              </div>
              <div>
                <h3 class="text-sm font-bold text-white font-sans">${po.name}</h3>
                <span class="text-[10px] font-mono text-amber-200/60">${itemsCountText}</span>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="my-2.5 p-3 rounded-xl bg-maroon-950/85 border border-maroon-700/80 flex items-baseline justify-between">
            <div>
              <div class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Modal Yang Ditarik:</div>
              <div class="text-xl sm:text-2xl font-mono font-extrabold ${isTaken ? 'text-emerald-400' : 'gold-metallic-text'} mt-0.5">
                ${formatRupiah(po.total_modal)}
              </div>
            </div>
            <div class="text-[10px] font-mono text-slate-400 text-right">
              ${po.transaction_count} transaksi
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
    btnSolo.className = "px-3 py-1 rounded-lg gold-gradient-bg text-maroon-950 font-bold transition-all shadow-sm";
    btnPatungan.className = "px-3 py-1 rounded-lg text-slate-400 hover:text-white transition-all";
    containerSolo.classList.remove("hidden");
    containerPatungan.classList.add("hidden");
  } else {
    btnSolo.className = "px-3 py-1 rounded-lg text-slate-400 hover:text-white transition-all";
    btnPatungan.className = "px-3 py-1 rounded-lg gold-gradient-bg text-maroon-950 font-bold transition-all shadow-sm";
    containerSolo.classList.add("hidden");
    containerPatungan.classList.remove("hidden");
    // DO NOT wipe or auto-split. Render existing amounts!
    renderPatunganRows();
  }
}

function renderSoloButtons() {
  const container = document.getElementById("soloPartnerButtons");
  if (!container) return;

  container.innerHTML = state.partners.map(p => {
    const isSelected = p.id === state.selectedSoloPartnerId;
    const activeClass = isSelected
      ? "border-gold-400 bg-gold-500/15 text-gold-300 shadow-[0_0_16px_rgba(212,175,55,0.25)] ring-1 ring-gold-400"
      : "border-maroon-700 bg-maroon-950/80 text-slate-300 hover:border-gold-500/40 hover:bg-maroon-850/60";

    return `
      <button type="button" onclick="selectSoloPartner(${p.id})" class="p-3 rounded-xl border ${activeClass} flex items-center gap-2.5 text-left transition-all">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shrink-0" style="background-color: ${p.color}25; color: ${p.color}; border: 1.5px solid ${p.color}60;">
          ${p.initials}
        </div>
        <div class="truncate min-w-0">
          <div class="text-xs font-bold text-white truncate">${p.name}</div>
          <div class="text-[9px] font-mono text-amber-200/60">100% Modal</div>
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
    const amountVal = state.patunganAmounts[p.id] || "";

    return `
      <div class="flex items-center gap-2.5 p-2.5 rounded-xl border ${isChecked ? 'border-gold-500/50 bg-gold-500/10' : 'border-maroon-700 bg-maroon-950/80'} transition-colors">
        <label class="flex items-center gap-2.5 cursor-pointer shrink-0">
          <input type="checkbox" onchange="togglePatunganPartner(${p.id}, this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-gold-500 focus:ring-0 accent-gold-500 cursor-pointer">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[10px] font-extrabold" style="background-color: ${p.color}25; color: ${p.color}; border: 1px solid ${p.color}50;">
            ${p.initials}
          </div>
          <span class="text-xs font-bold text-white w-24 sm:w-28 truncate">${p.name}</span>
        </label>

        <div class="flex-1 relative">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-gold-400/80">Rp</span>
          <input type="number" id="partnerAmountInput_${p.id}" value="${amountVal}" ${!isChecked ? 'disabled' : ''} oninput="setPartnerAmount(${p.id}, this.value)" placeholder="0" class="w-full bg-maroon-950 border border-maroon-700 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-gold-400 disabled:opacity-40 disabled:cursor-not-allowed">
        </div>
      </div>
    `;
  }).join("");

  updateUnallocatedCalculation();
}

function togglePatunganPartner(id, checked) {
  if (checked) {
    state.selectedPatunganPartners.add(id);
    // If not set yet, fill with remaining unallocated amount, without wiping others
    if (!state.patunganAmounts[id] || state.patunganAmounts[id] <= 0) {
      let allocated = 0;
      state.selectedPatunganPartners.forEach(pid => {
        if (pid !== id) allocated += (state.patunganAmounts[pid] || 0);
      });
      const remaining = Math.max(0, state.inputAmount - allocated);
      state.patunganAmounts[id] = remaining;
    }
  } else {
    state.selectedPatunganPartners.delete(id);
    delete state.patunganAmounts[id];
  }
  // NEVER call autoSplitEvenly() automatically!
  renderPatunganRows();
}

function setPartnerAmount(id, value) {
  const val = parseFloat(value) || 0;
  state.patunganAmounts[id] = val;
  updateUnallocatedCalculation();
}

// Explicit manual trigger ONLY
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
  // NEVER wipe partner amounts automatically! Just recalculate balance indicator
  updateUnallocatedCalculation();
}

function addAmount(delta) {
  state.inputAmount += delta;
  document.getElementById("inputTotalAmount").value = state.inputAmount;
  updateUnallocatedCalculation();
}

function clearAmount() {
  state.inputAmount = 0;
  document.getElementById("inputTotalAmount").value = "";
  state.patunganAmounts = {};
  renderPatunganRows();
}

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

  const galInput = document.getElementById("receiptGalleryInput");
  if (galInput) galInput.value = "";
  const camInput = document.getElementById("receiptCameraInput");
  if (camInput) camInput.value = "";

  const promptEl = document.getElementById("receiptPrompt");
  const loadingEl = document.getElementById("receiptLoading");
  const previewEl = document.getElementById("receiptPreviewBox");
  const badgeEl = document.getElementById("ocrStatusBadge");

  if (loadingEl) loadingEl.classList.add("hidden");
  if (previewEl) previewEl.classList.add("hidden");
  if (promptEl) promptEl.classList.remove("hidden");
  if (badgeEl) {
    badgeEl.textContent = "Auto-Fill Form";
    badgeEl.className = "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/40";
  }
  if (window.lucide) lucide.createIcons();
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

// ==================== SUBMIT TRANSACTION ====================
async function submitTransaction() {
  if (state.dailyBoard && state.dailyBoard.status === "CLOSED") {
    showToast("Buku transaksi sedang ditutup! Silakan buka buku terlebih dahulu.", false);
    promptOpenSession();
    return;
  }

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
    container.innerHTML = `<div class="text-center py-10 text-slate-400 text-xs">Belum ada transaksi pembelian pada sesi aktif ini.</div>`;
    return;
  }

  container.innerHTML = list.map(tx => {
    const sharesHtml = tx.shares.map(s => `
      <span class="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-maroon-950 border border-maroon-700">
        <span class="w-2 h-2 rounded-full" style="background-color: ${s.partner_color}"></span>
        <span class="font-bold text-slate-200">${s.partner_name}</span>: <span class="text-gold-300 font-semibold">${formatRupiah(s.amount)}</span> <span class="text-slate-400">(${s.percentage}%)</span>
      </span>
    `).join(" ");

    return `
      <article class="p-3.5 rounded-2xl bg-maroon-900/80 border border-gold-500/20 hover:border-gold-500/40 space-y-2.5 transition-colors shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-white font-sans">${tx.item_name}</h4>
              <span class="text-[9px] font-mono text-amber-200/70 bg-maroon-950 px-2 py-0.5 rounded-full border border-maroon-700">${tx.created_at.substring(11, 16)} WIB</span>
            </div>
            ${tx.notes ? `<p class="text-[11px] text-slate-400 mt-1">${tx.notes}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            ${tx.receipt_image ? `
              <button onclick="openReceiptModal('/api/v1/receipts/${tx.receipt_image}')" class="text-[10px] font-mono font-bold text-gold-300 hover:text-white px-2.5 py-1 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/35 flex items-center gap-1 transition-all shadow-sm">
                <i data-lucide="image" class="w-3 h-3 text-gold-400"></i>
                <span>Nota</span>
              </button>
            ` : ''}
            <span class="text-xs font-mono font-extrabold gold-metallic-text">${formatRupiah(tx.total_amount)}</span>
            <button onclick="deleteTransaction('${tx.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Hapus Transaksi">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1.5 border-t border-maroon-750">
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
  copyTextToClipboard(text, "Rekap WA berhasil disalin ke clipboard! Siap kirim ke grup.");
}

function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast(successMsg || "Berhasil disalin ke clipboard!");
}

// ==================== CLOSE & OPEN SESSIONS ====================
function handleMainSessionAction() {
  if (state.dailyBoard && state.dailyBoard.status === "CLOSED") {
    promptOpenSession();
  } else {
    promptCloseSession();
  }
}

async function promptOpenSession() {
  const conf = confirm(
    "BUKA BUKU TRANSAKSI BARU?\n\n" +
    "• Hari, tanggal, dan jam buka akan dicatat otomatis secara resmi.\n" +
    "• Papan modal dan daftar transaksi dimulai bersih dari Rp 0.\n\n" +
    "Lanjutkan buka buku sekarang?"
  );
  if (!conf) return;

  try {
    const res = await fetch("/api/v1/day/open", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || "Buku berhasil dibuka! Sesi baru aktif.");
      await loadAllData();
      switchTab("payout");
    } else {
      showToast(data.detail || "Gagal membuka buku", false);
    }
  } catch (err) {
    showToast("Gagal menyambung ke server", false);
  }
}

async function promptCloseSession() {
  const isAll = state.dailyBoard && state.dailyBoard.all_settled;
  const msg = isAll 
    ? "TUTUP BUKU TRANSAKSI?\n\n" +
      "• Seluruh transaksi sesi ini akan diarsipkan ke Riwayat.\n" +
      "• Status buku kasir akan DITUTUP (modal kembali ke Rp 0).\n" +
      "• Sesi baru hanya akan terbuka ketika Anda menekan 'Buka Buku'.\n\n" +
      "Tutup buku sekarang?"
    : "PERHATIAN: Masih ada pemodal yang belum ambil cash di meja kasir!\n\n" +
      "Yakin ingin menutup buku sesi ini? Data akan diarsipkan ke Riwayat dan status buku akan DITUTUP.";
  
  if (!confirm(msg)) return;

  try {
    const res = await fetch("/api/v1/day/close", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast("Buku transaksi berhasil ditutup & diarsipkan.");
      await loadAllData();
      switchTab("payout");
    } else {
      showToast(data.detail || "Gagal menutup sesi", false);
    }
  } catch (err) {
    showToast("Gagal menutup sesi", false);
  }
}

// ==================== HISTORY ARCHIVE ====================
async function loadHistoryData() {
  const container = document.getElementById("historyListContainer");
  if (!container) return;

  try {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 font-mono text-xs flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-gold-400"></i> Memuat arsip riwayat...</div>`;
    if (window.lucide) lucide.createIcons();

    const res = await fetch("/api/v1/history");
    const data = await res.json();

    if (data.success) {
      state.historyList = data.data;
      renderHistoryList();
    }
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-rose-400 text-xs">Gagal memuat arsip riwayat</div>`;
  }
}

function renderHistoryList() {
  const container = document.getElementById("historyListContainer");
  if (!container) return;

  const list = state.historyList || [];
  if (list.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-slate-400 text-xs">Belum ada riwayat sesi buku.</div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const isClosed = item.status === "CLOSED";
    const statusPill = isClosed
      ? `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">DITUTUP (${item.closed_at_formatted || 'Arsip'})</span>`
      : `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 animate-pulse">SEDANG AKTIF</span>`;

    return `
      <article class="p-4 rounded-2xl bg-maroon-900/80 border ${isClosed ? 'border-gold-500/25' : 'border-emerald-500/40'} space-y-3 shadow-md">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-white font-sans">${item.display_name}</h4>
            <div class="text-[10px] font-mono text-amber-200/60 mt-0.5">${item.total_transactions} Transaksi</div>
          </div>
          <div>${statusPill}</div>
        </div>

        <div class="flex items-center justify-between p-3 rounded-xl bg-maroon-950/80 border border-maroon-700/80">
          <span class="text-xs text-slate-400">Total Modal Sesi:</span>
          <span class="text-base sm:text-lg font-mono font-extrabold gold-metallic-text">${item.total_capital_formatted}</span>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button type="button" onclick="openHistoryDetail('${item.date_str}')" class="flex-1 py-2 px-3 rounded-xl bg-maroon-850 hover:bg-maroon-750 border border-gold-500/30 text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-gold-400"></i>
            <span>Lihat Rincian Sesi</span>
          </button>
          <button type="button" onclick="copyHistoryWA('${item.date_str}')" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]">
            <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
            <span>Salin WA</span>
          </button>
        </div>
      </article>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

async function copyHistoryWA(dateStr) {
  try {
    const res = await fetch(`/api/v1/history/${dateStr}`);
    const data = await res.json();
    if (data.success && data.data && data.data.board) {
      copyTextToClipboard(data.data.board.whatsapp_rekap, `Rekap WA sesi ${data.data.board.display_name} disalin ke clipboard!`);
    } else {
      showToast("Gagal memuat rekap", false);
    }
  } catch (err) {
    showToast("Kendala memuat data WA", false);
  }
}

async function openHistoryDetail(dateStr) {
  const modal = document.getElementById("modalHistoryDetail");
  const content = document.getElementById("historyModalContent");
  const title = document.getElementById("historyModalTitle");
  const status = document.getElementById("historyModalStatus");
  if (!modal || !content) return;

  modal.classList.remove("hidden");
  content.innerHTML = `<div class="text-center py-8 text-slate-400 font-mono text-xs flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-gold-400"></i> Memuat detail sesi...</div>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch(`/api/v1/history/${dateStr}`);
    const data = await res.json();

    if (data.success && data.data) {
      const board = data.data.board;
      const txs = data.data.transactions;
      state.selectedHistoryBoard = board;

      if (title) title.textContent = board.display_name || dateStr;
      if (status) {
        status.textContent = board.status === "CLOSED" ? `BUKU DITUTUP (${board.closed_at ? board.closed_at.substring(11, 16) + ' WIB' : 'Arsip'})` : "SESI AKTIF";
        status.className = board.status === "CLOSED" ? "text-[10px] font-mono text-slate-400" : "text-[10px] font-mono text-emerald-400";
      }

      const payoutsHtml = board.payouts.map(po => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-maroon-950 border border-maroon-700 text-xs">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-[10px]" style="background-color: ${po.color}25; color: ${po.color};">
              ${po.initials}
            </div>
            <span class="font-bold text-white">${po.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold ${po.is_taken ? 'text-emerald-400' : 'text-gold-400'}">${formatRupiah(po.total_modal)}</span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded ${po.is_taken ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${po.is_taken ? 'LUNAS' : (po.total_modal > 0 ? 'BELUM' : '-')}</span>
          </div>
        </div>
      `).join("");

      const txsHtml = txs.length === 0 ? `<p class="text-xs text-slate-500 py-2">Tidak ada transaksi pada sesi ini.</p>` : txs.map(t => `
        <div class="p-2.5 rounded-xl bg-maroon-950 border border-maroon-700 space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-white">${t.item_name}</span>
            <span class="font-mono font-bold text-gold-400">${formatRupiah(t.total_amount)}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${t.shares.map(s => `
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-maroon-900 border border-maroon-700 text-slate-300">
                ${s.partner_name}: ${formatRupiah(s.amount)}
              </span>
            `).join(" ")}
          </div>
        </div>
      `).join("");

      content.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 rounded-xl bg-maroon-950 border border-gold-500/30 flex items-baseline justify-between">
            <span class="text-xs text-slate-400">Total Modal Ditarik:</span>
            <span class="text-xl font-mono font-extrabold gold-metallic-text">${formatRupiah(board.total_capital)}</span>
          </div>

          <div>
            <h5 class="text-xs font-bold text-amber-200/80 mb-1.5">Pengembalian Modal 7 Pemodal:</h5>
            <div class="space-y-1.5">
              ${payoutsHtml}
            </div>
          </div>

          <div>
            <h5 class="text-xs font-bold text-amber-200/80 mb-1.5">Daftar Transaksi (${txs.length}):</h5>
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              ${txsHtml}
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    content.innerHTML = `<div class="text-center py-8 text-rose-400 text-xs">Gagal memuat rincian sesi.</div>`;
  }

  if (window.lucide) lucide.createIcons();
}

function closeHistoryDetailModal() {
  const modal = document.getElementById("modalHistoryDetail");
  if (modal) modal.classList.add("hidden");
}

function copySpecificHistoryWA() {
  if (state.selectedHistoryBoard && state.selectedHistoryBoard.whatsapp_rekap) {
    copyTextToClipboard(state.selectedHistoryBoard.whatsapp_rekap, "Rekap WA riwayat sesi berhasil disalin ke clipboard!");
  } else {
    showToast("Data WA tidak ditemukan", false);
  }
}

// ==================== SETTINGS (PARTNER NAMES) ====================
function openSettingsModal() {
  const modal = document.getElementById("modalSettings");
  const container = document.getElementById("settingsPartnersList");
  if (!modal || !container) return;

  container.innerHTML = state.partners.map(p => `
    <div class="flex items-center gap-2 bg-maroon-950 p-2 rounded-xl border border-maroon-700">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs shrink-0" style="background-color: ${p.color}25; color: ${p.color}; border: 1.5px solid ${p.color}50;">
        ${p.initials}
      </div>
      <input type="text" id="partnerNameInput_${p.id}" value="${p.name}" class="flex-1 bg-maroon-900 border border-maroon-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400 font-bold" placeholder="Nama Pemodal">
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