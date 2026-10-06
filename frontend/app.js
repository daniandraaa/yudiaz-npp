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
  selectedGoldCategory: "LM",
};

// ==================== THEME MANAGEMENT (LIGHT LUXURY DEFAULT) ====================
function initTheme() {
  const saved = localStorage.getItem("npp_theme") || "light";
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  updateThemeButtonUI();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  const theme = isDark ? "dark" : "light";
  localStorage.setItem("npp_theme", theme);
  updateThemeButtonUI();
  
  // Re-render UI components to sync dynamic theme styling
  if (state.dailyBoard) {
    renderDailyBoard();
  }
  if (state.partners && state.partners.length > 0) {
    renderSoloButtons();
    if (state.fundingMode === "patungan") renderPatunganRows();
  }
  if (state.transactions) {
    renderTransactionsList();
  }
  if (state.historyList) {
    renderHistoryList();
  }
}

function updateThemeButtonUI() {
  const isDark = document.documentElement.classList.contains("dark");
  const btnText = document.getElementById("themeToggleText");
  const sunIcon = document.getElementById("themeSunIcon");
  const moonIcon = document.getElementById("themeMoonIcon");
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (isDark) {
    if (btnText) btnText.textContent = "Gelap";
    if (sunIcon) sunIcon.classList.add("hidden");
    if (moonIcon) moonIcon.classList.remove("hidden");
    if (metaTheme) metaTheme.setAttribute("content", "#0A0204");
  } else {
    if (btnText) btnText.textContent = "Terang";
    if (sunIcon) sunIcon.classList.remove("hidden");
    if (moonIcon) moonIcon.classList.add("hidden");
    if (metaTheme) metaTheme.setAttribute("content", "#F8F6F0");
  }
  if (window.lucide) lucide.createIcons();
}

// ==================== GOLD CATEGORY (LM VS NON-LM) ====================
function setGoldCategory(cat) {
  state.selectedGoldCategory = cat === "NON_LM" ? "NON_LM" : "LM";
  const btnLM = document.getElementById("btnCatLM");
  const btnNonLM = document.getElementById("btnCatNON_LM");
  const checkLM = document.getElementById("checkCatLM");
  const checkNonLM = document.getElementById("checkCatNON_LM");
  const hiddenInput = document.getElementById("selectedGoldCategory");

  if (hiddenInput) hiddenInput.value = state.selectedGoldCategory;

  if (state.selectedGoldCategory === "LM") {
    if (btnLM) {
      btnLM.className = "relative flex items-center gap-2.5 p-3 rounded-xl border border-amber-400 bg-amber-50/80 dark:border-gold-400 dark:bg-gradient-to-r dark:from-gold-500/25 dark:to-maroon-900 text-left transition-all shadow-xs ring-1 ring-amber-300";
    }
    if (checkLM) {
      checkLM.className = "absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-amber-500 dark:bg-gold-400 text-white dark:text-maroon-950 flex items-center justify-center text-[10px] font-extrabold shadow-xs";
      checkLM.textContent = "✓";
    }
    if (btnNonLM) {
      btnNonLM.className = "relative flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 dark:border-maroon-700 bg-[#FAF8F5] dark:bg-maroon-950/80 text-left transition-all opacity-70 hover:opacity-100";
    }
    if (checkNonLM) {
      checkNonLM.className = "absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-stone-200 dark:bg-maroon-800 text-transparent flex items-center justify-center text-[10px] font-extrabold";
      checkNonLM.textContent = "✓";
    }
  } else {
    if (btnLM) {
      btnLM.className = "relative flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 dark:border-maroon-700 bg-[#FAF8F5] dark:bg-maroon-950/80 text-left transition-all opacity-70 hover:opacity-100";
    }
    if (checkLM) {
      checkLM.className = "absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-stone-200 dark:bg-maroon-800 text-transparent flex items-center justify-center text-[10px] font-extrabold";
      checkLM.textContent = "✓";
    }
    if (btnNonLM) {
      btnNonLM.className = "relative flex items-center gap-2.5 p-3 rounded-xl border border-rose-400 bg-rose-50/80 dark:border-rose-400 dark:bg-gradient-to-r dark:from-rose-500/25 dark:to-maroon-900 text-left transition-all shadow-xs ring-1 ring-rose-300";
    }
    if (checkNonLM) {
      checkNonLM.className = "absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-rose-500 dark:bg-rose-400 text-white flex items-center justify-center text-[10px] font-extrabold shadow-xs";
      checkNonLM.textContent = "✓";
    }
  }
}

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
    iconEl.className = isSuccess ? "w-4 h-4 text-amber-500 dark:text-gold-400" : "w-4 h-4 text-rose-500";
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
        btn.className = "flex items-center justify-center gap-1.5 py-2.5 px-1 sm:px-3 rounded-xl text-xs font-bold transition-all gold-gradient-bg text-stone-900 shadow-sm";
      } else {
        btn.className = "flex items-center justify-center gap-1.5 py-2.5 px-1 sm:px-3 rounded-xl text-xs font-bold text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-gold-300 hover:bg-stone-200/50 dark:hover:bg-maroon-850/60 transition-all";
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
        ? "flex flex-col items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-gold-400"
        : "flex flex-col items-center gap-1 text-[10px] font-semibold text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white";
    }
  });

  if (tab === "history") {
    loadHistoryData();
  }

  if (window.lucide) lucide.createIcons();
}

// ==================== DATA FETCHING ====================
async function loadAllData(silent = false) {
  try {
    const refreshIcon = document.getElementById("refreshIcon");
    if (refreshIcon && !silent) refreshIcon.classList.add("animate-spin");

    // 1. Fetch Partners
    const pRes = await fetch("/api/v1/partners");
    const pData = await pRes.json();
    if (pData.success) {
      state.partners = pData.data;
      const isInputActive = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (!isInputActive || state.currentTab !== "input") {
        renderSoloButtons();
        renderPatunganRows();
      }
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

    if (refreshIcon && !silent) setTimeout(() => refreshIcon.classList.remove("animate-spin"), 400);
  } catch (err) {
    console.error("Failed loading data:", err);
    if (!silent) showToast("Gagal menyambung ke server", false);
  }
}

function refreshData() {
  loadAllData();
  showToast("Data berhasil diperbarui");
}

// Background Live Sync (Keeps all 7-10 partners in sync every 7 seconds)
setInterval(() => {
  if (document.hidden) return;
  const isTyping = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
  if (isTyping && state.currentTab === "input") return;
  loadAllData(true);
}, 7000);

// Auto-sync when user returns to tab / turns screen back on
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadAllData(true);
  }
});

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
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse";
    }
  }

  const badge = document.getElementById("sessionStatusBadge");
  if (badge) {
    if (isClosed) {
      badge.textContent = "BUKU DITUTUP";
      badge.className = "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40";
    } else {
      badge.textContent = "SESI AKTIF";
      badge.className = "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/35";
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
      toggleBtn.className = "py-3.5 px-4 rounded-xl gold-gradient-bg gold-gradient-bg-hover text-stone-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]";
      toggleText.textContent = "Buka Buku Baru";
      if (toggleIcon) toggleIcon.setAttribute("data-lucide", "book-open");
    } else {
      toggleBtn.className = "py-3 px-4 rounded-xl luxury-well hover:border-gold-500/50 text-stone-700 dark:text-amber-100/80 font-mono text-xs flex items-center justify-center gap-2 transition-all";
      toggleText.textContent = "Tutup Buku Hari Ini";
      if (toggleIcon) toggleIcon.setAttribute("data-lucide", "lock");
    }
  }

  document.getElementById("heroTotalCapital").textContent = formatRupiah(board.total_capital);
  document.getElementById("heroTotalTrx").textContent = `${board.total_transactions} trx`;

  // Dynamic Partner counts
  const totalPartnerCount = board.payouts ? board.payouts.length : (state.partners.length || 7);
  const settledCount = board.payouts ? board.payouts.filter(p => p.is_taken || p.total_modal === 0).length : 0;
  
  const heroSettledEl = document.getElementById("heroSettledCount");
  if (heroSettledEl) heroSettledEl.textContent = `${settledCount} / ${totalPartnerCount} Lunas`;

  const payoutBadgeEl = document.getElementById("payoutPartnerCountBadge");
  if (payoutBadgeEl) payoutBadgeEl.textContent = `${totalPartnerCount} Pemodal Emas`;

  // Render Sales & Profit Card
  const salesCapEl = document.getElementById("salesCardCapital");
  if (salesCapEl) salesCapEl.textContent = formatRupiah(board.total_capital);

  const salesRevEl = document.getElementById("salesCardRevenue");
  const salesProfEl = document.getElementById("salesCardProfit");
  const salesBadgeEl = document.getElementById("salesProfitBadge");
  const btnSalesTxt = document.getElementById("btnSalesActionText");

  if (board.sales_revenue && board.sales_revenue > 0) {
    if (salesRevEl) salesRevEl.textContent = formatRupiah(board.sales_revenue);
    if (btnSalesTxt) btnSalesTxt.textContent = "Ubah Hasil Jual";
    
    const profitSign = board.net_profit >= 0 ? "+" : "";
    if (salesProfEl) {
      salesProfEl.textContent = `${profitSign}${formatRupiah(board.net_profit)}`;
      salesProfEl.className = board.net_profit >= 0 
        ? "text-base sm:text-lg font-mono font-extrabold text-emerald-700 dark:text-emerald-400 mt-1" 
        : "text-base sm:text-lg font-mono font-extrabold text-rose-600 dark:text-rose-400 mt-1";
    }
    if (salesBadgeEl) {
      salesBadgeEl.textContent = `${profitSign}${board.profit_percentage}%`;
      salesBadgeEl.className = board.net_profit >= 0
        ? "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40"
        : "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40";
    }
  } else {
    if (salesRevEl) salesRevEl.innerHTML = `<span class="text-stone-400 dark:text-slate-500 italic text-xs font-normal">Belum diinput</span>`;
    if (btnSalesTxt) btnSalesTxt.textContent = "Input Hasil Jual Sore";
    if (salesProfEl) {
      salesProfEl.innerHTML = `<span class="text-stone-400 dark:text-slate-500 italic text-xs font-normal">Menunggu Penjualan Sore</span>`;
      salesProfEl.className = "text-base sm:text-lg font-mono font-extrabold text-stone-500 dark:text-slate-400 mt-1";
    }
    if (salesBadgeEl) {
      salesBadgeEl.textContent = "0%";
      salesBadgeEl.className = "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 dark:bg-maroon-900 dark:text-slate-400 border border-stone-200 dark:border-maroon-750";
    }
  }

  // Update Category Breakdown on Card (LM vs Non-LM)
  const badgeLM = document.getElementById("badgeTrxLM");
  if (badgeLM) badgeLM.textContent = `${board.total_trx_lm || 0} trx`;
  const capLM = document.getElementById("cardCapLM");
  if (capLM) capLM.textContent = formatRupiah(board.total_capital_lm || 0);
  const revLM = document.getElementById("cardRevLM");
  if (revLM) revLM.textContent = (board.sales_revenue_lm && board.sales_revenue_lm > 0) ? formatRupiah(board.sales_revenue_lm) : "-";
  const profLM = document.getElementById("cardProfLM");
  if (profLM) {
    if (board.sales_revenue_lm && board.sales_revenue_lm > 0) {
      const pSign = board.profit_lm >= 0 ? "+" : "";
      profLM.textContent = `${pSign}${formatRupiah(board.profit_lm)} (${pSign}${board.profit_pct_lm}%)`;
      profLM.className = board.profit_lm >= 0 ? "font-extrabold text-emerald-700 dark:text-emerald-400" : "font-extrabold text-rose-600 dark:text-rose-400";
    } else {
      profLM.textContent = "-";
      profLM.className = "font-extrabold text-stone-400 dark:text-slate-500";
    }
  }

  const badgeNonLM = document.getElementById("badgeTrxNonLM");
  if (badgeNonLM) badgeNonLM.textContent = `${board.total_trx_non_lm || 0} trx`;
  const capNonLM = document.getElementById("cardCapNonLM");
  if (capNonLM) capNonLM.textContent = formatRupiah(board.total_capital_non_lm || 0);
  const revNonLM = document.getElementById("cardRevNonLM");
  if (revNonLM) revNonLM.textContent = (board.sales_revenue_non_lm && board.sales_revenue_non_lm > 0) ? formatRupiah(board.sales_revenue_non_lm) : "-";
  const profNonLM = document.getElementById("cardProfNonLM");
  if (profNonLM) {
    if (board.sales_revenue_non_lm && board.sales_revenue_non_lm > 0) {
      const pSign = board.profit_non_lm >= 0 ? "+" : "";
      profNonLM.textContent = `${pSign}${formatRupiah(board.profit_non_lm)} (${pSign}${board.profit_pct_non_lm}%)`;
      profNonLM.className = board.profit_non_lm >= 0 ? "font-extrabold text-emerald-700 dark:text-emerald-400" : "font-extrabold text-rose-600 dark:text-rose-400";
    } else {
      profNonLM.textContent = "-";
      profNonLM.className = "font-extrabold text-stone-400 dark:text-slate-500";
    }
  }

  // Update Inline Sales Card Inputs
  const inlineCapEl = document.getElementById("inlineSalesCapText");
  if (inlineCapEl) inlineCapEl.textContent = `Total Modal: ${formatRupiah(board.total_capital)}`;
  const inlineCapLM = document.getElementById("inlineCapLMText");
  if (inlineCapLM) inlineCapLM.textContent = `Modal LM: ${formatRupiah(board.total_capital_lm || 0)}`;
  const inlineCapNonLM = document.getElementById("inlineCapNonLMText");
  if (inlineCapNonLM) inlineCapNonLM.textContent = `Modal Non-LM: ${formatRupiah(board.total_capital_non_lm || 0)}`;

  const inLM = document.getElementById("inlineInputSalesLM");
  if (inLM && !inLM.value && board.sales_revenue_lm > 0) inLM.value = board.sales_revenue_lm;
  const inNonLM = document.getElementById("inlineInputSalesNonLM");
  if (inNonLM && !inNonLM.value && board.sales_revenue_non_lm > 0) inNonLM.value = board.sales_revenue_non_lm;

  updateInlineSalesCalc();

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
    
    // Status visual styles matching Light Luxury & Dark Velvet
    let cardBorder = "border-stone-200 bg-[#FAF8F5] dark:border-maroon-700/70 dark:bg-maroon-900/60";
    let statusBadge = "";
    let btnAction = "";

    if (isZero) {
      statusBadge = `<span class="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-500 dark:bg-maroon-950 dark:text-slate-400 border border-stone-200 dark:border-maroon-700">TIDAK ADA MODAL</span>`;
      btnAction = `<div class="text-[11px] font-mono text-stone-400 dark:text-slate-500 italic py-1 text-center">Tidak keluar modal sesi ini</div>`;
    } else if (isTaken) {
      cardBorder = "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-gradient-to-b dark:from-maroon-900/90 dark:to-emerald-950/20 shadow-xs";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/35"><i data-lucide="check-check" class="w-3 h-3"></i> LUNAS AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, false)" class="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-maroon-850 hover:bg-stone-50 dark:hover:bg-maroon-800 border border-stone-200 dark:border-maroon-700 text-stone-700 dark:text-slate-300 font-mono text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors">
          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-stone-400"></i>
          <span>Ubah ke Belum Ambil</span>
        </button>
      `;
    } else {
      cardBorder = "border-amber-400 bg-gradient-to-b from-white to-amber-50/40 dark:from-maroon-850 dark:to-maroon-900 shadow-[0_8px_25px_rgba(212,175,55,0.18)] ring-1 ring-amber-300 dark:ring-gold-500/30";
      statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-gold-500/15 dark:text-gold-300 border border-amber-300 dark:border-gold-500/40 animate-pulse"><i data-lucide="clock" class="w-3 h-3 text-amber-600 dark:text-gold-400"></i> WAJIB AMBIL CASH</span>`;
      btnAction = `
        <button onclick="togglePayout(${po.partner_id}, true)" class="w-full py-2.5 px-3 rounded-xl gold-gradient-bg gold-gradient-bg-hover text-stone-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all">
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
              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shadow-xs shrink-0" style="background-color: ${po.color}25; color: ${po.color}; border: 1.5px solid ${po.color}60;">
                ${po.initials}
              </div>
              <div>
                <h3 class="text-sm font-bold text-stone-900 dark:text-white font-sans">${po.name}</h3>
                <span class="text-[10px] font-mono text-stone-500 dark:text-amber-200/60">${itemsCountText}</span>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="my-2.5 p-3 rounded-xl luxury-well flex items-baseline justify-between">
            <div>
              <div class="text-[10px] font-mono uppercase tracking-wider text-stone-500 dark:text-slate-400">Modal Yang Ditarik:</div>
              <div class="text-xl sm:text-2xl font-mono font-extrabold ${isTaken ? 'text-emerald-700 dark:text-emerald-400' : 'gold-metallic-text'} mt-0.5">
                ${formatRupiah(po.total_modal)}
              </div>
            </div>
            <div class="text-[10px] font-mono text-stone-500 dark:text-slate-400 text-right">
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
    btnSolo.className = "px-3 py-1 rounded-lg gold-gradient-bg text-stone-900 font-bold transition-all shadow-xs";
    btnPatungan.className = "px-3 py-1 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white transition-all";
    containerSolo.classList.remove("hidden");
    containerPatungan.classList.add("hidden");
  } else {
    btnSolo.className = "px-3 py-1 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white transition-all";
    btnPatungan.className = "px-3 py-1 rounded-lg gold-gradient-bg text-stone-900 font-bold transition-all shadow-xs";
    containerSolo.classList.add("hidden");
    containerPatungan.classList.remove("hidden");
    renderPatunganRows();
  }
}

function renderSoloButtons() {
  const container = document.getElementById("soloPartnerButtons");
  if (!container) return;

  container.innerHTML = state.partners.map(p => {
    const isSelected = p.id === state.selectedSoloPartnerId;
    const activeClass = isSelected
      ? "border-amber-400 bg-amber-50/80 text-stone-900 shadow-sm ring-1 ring-amber-300 dark:border-gold-400 dark:bg-gold-500/15 dark:text-gold-300"
      : "border-stone-200 dark:border-maroon-700 bg-[#FAF8F5] dark:bg-maroon-950/80 text-stone-700 dark:text-slate-300 hover:border-amber-300";

    return `
      <button type="button" onclick="selectSoloPartner(${p.id})" class="p-3 rounded-xl border ${activeClass} flex items-center gap-2.5 text-left transition-all">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shrink-0" style="background-color: ${p.color}25; color: ${p.color}; border: 1.5px solid ${p.color}60;">
          ${p.initials}
        </div>
        <div class="truncate min-w-0">
          <div class="text-xs font-bold text-stone-900 dark:text-white truncate">${p.name}</div>
          <div class="text-[9px] font-mono text-stone-500 dark:text-amber-200/60">100% Modal</div>
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
      <div class="flex items-center gap-2.5 p-2.5 rounded-xl border ${isChecked ? 'border-amber-400 bg-amber-50/70 dark:border-gold-500/50 dark:bg-gold-500/10' : 'border-stone-200 dark:border-maroon-700 bg-[#FAF8F5] dark:bg-maroon-950/80'} transition-colors">
        <label class="flex items-center gap-2.5 cursor-pointer shrink-0">
          <input type="checkbox" onchange="togglePatunganPartner(${p.id}, this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-amber-600 dark:text-gold-500 focus:ring-0 accent-amber-500 cursor-pointer">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[10px] font-extrabold" style="background-color: ${p.color}25; color: ${p.color}; border: 1px solid ${p.color}50;">
            ${p.initials}
          </div>
          <span class="text-xs font-bold text-stone-900 dark:text-white w-24 sm:w-28 truncate">${p.name}</span>
        </label>

        <div class="flex-1 relative">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-amber-700 dark:text-gold-400/80">Rp</span>
          <input type="number" id="partnerAmountInput_${p.id}" value="${amountVal}" ${!isChecked ? 'disabled' : ''} oninput="setPartnerAmount(${p.id}, this.value)" placeholder="0" class="w-full bg-white dark:bg-maroon-950 border border-stone-300 dark:border-maroon-700 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-mono font-bold text-stone-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400 disabled:opacity-40 disabled:cursor-not-allowed">
        </div>
      </div>
    `;
  }).join("");

  updateUnallocatedCalculation();
}

function togglePatunganPartner(id, checked) {
  if (checked) {
    state.selectedPatunganPartners.add(id);
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
    display.className = "font-bold text-emerald-600 dark:text-emerald-400";
  } else if (diff > 0) {
    display.textContent = `Kurang ${formatRupiah(diff)}`;
    display.className = "font-bold text-amber-600 dark:text-amber-400";
  } else {
    display.textContent = `Lebih ${formatRupiah(Math.abs(diff))}`;
    display.className = "font-bold text-rose-600 dark:text-rose-400";
  }
}

// Amount Shortcuts
function handleAmountInput(val) {
  state.inputAmount = parseFloat(val) || 0;
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
    badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse";
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
          amountInput.classList.add("border-amber-400", "bg-amber-50/50");
          setTimeout(() => amountInput.classList.remove("border-amber-400", "bg-amber-50/50"), 1500);
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
        badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300";
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
    badgeEl.className = "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-gold-300 border border-amber-500/40";
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

  const goldCat = state.selectedGoldCategory || "LM";

  const payload = {
    item_name: itemName || undefined,
    gold_category: goldCat,
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
      setGoldCategory("LM");
      document.getElementById("inputItemName").value = "";
      document.getElementById("inputNotes").value = "";
      await loadAllData();
      switchTab("payout");
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
    container.innerHTML = `<div class="text-center py-10 text-stone-400 dark:text-slate-400 text-xs">Belum ada transaksi pembelian pada sesi aktif ini.</div>`;
    return;
  }

  container.innerHTML = list.map(tx => {
    const sharesHtml = tx.shares.map(s => `
      <span class="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-lg luxury-well">
        <span class="w-2 h-2 rounded-full" style="background-color: ${s.partner_color}"></span>
        <span class="font-bold text-stone-900 dark:text-slate-200">${s.partner_name}</span>: <span class="text-amber-800 dark:text-gold-300 font-semibold">${formatRupiah(s.amount)}</span> <span class="text-stone-500 dark:text-slate-400">(${s.percentage}%)</span>
      </span>
    `).join(" ");

    return `
      <article class="p-3.5 rounded-2xl luxury-card hover:border-amber-400 space-y-2.5 transition-colors shadow-xs">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-stone-900 dark:text-white font-sans">${tx.item_name}</h4>
              ${tx.gold_category === "NON_LM" 
                ? '<span class="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/35 px-2 py-0.5 rounded-full">💍 Non-LM</span>'
                : '<span class="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 dark:text-gold-300 bg-amber-50 dark:bg-gold-500/15 border border-amber-300 dark:border-gold-500/35 px-2 py-0.5 rounded-full">🪙 LM</span>'}
              <span class="text-[9px] font-mono text-stone-600 dark:text-amber-200/70 bg-stone-100 dark:bg-maroon-950 px-2 py-0.5 rounded-full border border-stone-200 dark:border-maroon-700">${tx.created_at.substring(11, 16)} WIB</span>
            </div>
            ${tx.notes ? `<p class="text-[11px] text-stone-500 dark:text-slate-400 mt-1">${tx.notes}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            ${tx.receipt_image ? `
              <button onclick="openReceiptModal('/api/v1/receipts/${tx.receipt_image}')" class="text-[10px] font-mono font-bold text-amber-800 dark:text-gold-300 hover:text-stone-900 dark:hover:text-white px-2.5 py-1 rounded-lg luxury-well flex items-center gap-1 transition-all shadow-xs">
                <i data-lucide="image" class="w-3 h-3 text-amber-600 dark:text-gold-400"></i>
                <span>Nota</span>
              </button>
            ` : ''}
            <span class="text-xs font-mono font-extrabold gold-metallic-text">${formatRupiah(tx.total_amount)}</span>
            <button onclick="deleteTransaction('${tx.id}')" class="text-stone-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Hapus Transaksi">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1.5 border-t border-stone-200 dark:border-maroon-750">
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
    container.innerHTML = `<div class="text-center py-8 text-stone-400 dark:text-slate-400 font-mono text-xs flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-600 dark:text-gold-400"></i> Memuat arsip riwayat...</div>`;
    if (window.lucide) lucide.createIcons();

    const res = await fetch("/api/v1/history");
    const data = await res.json();

    if (data.success) {
      state.historyList = data.data;
      renderHistoryList();
    }
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-rose-500 text-xs">Gagal memuat arsip riwayat</div>`;
  }
}

function renderHistoryList() {
  const container = document.getElementById("historyListContainer");
  if (!container) return;

  const list = state.historyList || [];
  if (list.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-stone-400 dark:text-slate-400 text-xs">Belum ada riwayat sesi buku.</div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const isClosed = item.status === "CLOSED";
    const statusPill = isClosed
      ? `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300 border border-stone-200 dark:border-slate-700">DITUTUP (${item.closed_at_formatted || 'Arsip'})</span>`
      : `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/35 animate-pulse">SEDANG AKTIF</span>`;

    return `
      <article class="p-4 rounded-2xl luxury-card space-y-3 shadow-md">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-stone-900 dark:text-white font-sans">${item.display_name}</h4>
            <div class="text-[10px] font-mono text-stone-500 dark:text-amber-200/60 mt-0.5">${item.total_transactions} Transaksi</div>
          </div>
          <div>${statusPill}</div>
        </div>

        <!-- Metrics Grid: Modal, Jual, Laba -->
        <div class="grid grid-cols-3 gap-2 p-3 rounded-xl luxury-well text-xs font-mono">
          <div>
            <div class="text-[9px] text-stone-500 dark:text-slate-400 uppercase">Modal:</div>
            <div class="font-extrabold text-stone-900 dark:text-slate-200 text-xs sm:text-sm mt-0.5 truncate">${item.total_capital_formatted}</div>
          </div>
          <div>
            <div class="text-[9px] text-amber-700 dark:text-gold-400 uppercase">Hasil Jual:</div>
            <div class="font-extrabold gold-metallic-text text-xs sm:text-sm mt-0.5 truncate">${item.sales_revenue > 0 ? item.sales_revenue_formatted : '-'}</div>
          </div>
          <div>
            <div class="text-[9px] text-emerald-700 dark:text-emerald-400 uppercase">Keuntungan:</div>
            <div class="font-extrabold ${item.sales_revenue > 0 ? (item.net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-stone-400 dark:text-slate-500'} text-xs sm:text-sm mt-0.5 truncate">
              ${item.sales_revenue > 0 ? `${item.net_profit >= 0 ? '+' : ''}${item.net_profit_formatted}` : '<span class="italic text-[10px]">Belum diinput</span>'}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button type="button" onclick="openSalesModal('${item.date_str}')" class="py-2 px-3 rounded-xl luxury-well hover:border-amber-400 text-amber-800 dark:text-gold-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs" title="Input atau Edit Hasil Penjualan Sore">
            <i data-lucide="circle-dollar-sign" class="w-3.5 h-3.5"></i>
            <span>${item.sales_revenue > 0 ? 'Ubah Jual' : 'Input Jual'}</span>
          </button>
          <button type="button" onclick="openHistoryDetail('${item.date_str}')" class="flex-1 py-2 px-3 rounded-xl luxury-well hover:border-amber-400 text-stone-800 dark:text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-amber-600 dark:text-gold-400"></i>
            <span>Rincian Sesi</span>
          </button>
          <button type="button" onclick="copyHistoryWA('${item.date_str}')" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98]">
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
  content.innerHTML = `<div class="text-center py-8 text-stone-400 dark:text-slate-400 font-mono text-xs flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-600 dark:text-gold-400"></i> Memuat detail sesi...</div>`;
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
        status.className = board.status === "CLOSED" ? "text-[10px] font-mono text-stone-500 dark:text-slate-400" : "text-[10px] font-mono text-emerald-600 dark:text-emerald-400";
      }

      const payoutsHtml = board.payouts.map(po => `
        <div class="flex items-center justify-between p-2 rounded-xl luxury-well text-xs">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-[10px]" style="background-color: ${po.color}25; color: ${po.color};">
              ${po.initials}
            </div>
            <span class="font-bold text-stone-900 dark:text-white">${po.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold ${po.is_taken ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-gold-400'}">${formatRupiah(po.total_modal)}</span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded ${po.is_taken ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-slate-800 dark:text-slate-400'}">${po.is_taken ? 'LUNAS' : (po.total_modal > 0 ? 'BELUM' : '-')}</span>
          </div>
        </div>
      `).join("");

      const txsHtml = txs.length === 0 ? `<p class="text-xs text-stone-400 italic text-center py-2">Tidak ada transaksi pada sesi ini.</p>` : txs.map(t => `
        <div class="p-2.5 rounded-xl luxury-well space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-stone-900 dark:text-white">${t.item_name}</span>
            <span class="font-mono font-bold text-amber-700 dark:text-gold-400">${formatRupiah(t.total_amount)}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${t.shares.map(s => `
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-maroon-900 border border-stone-200 dark:border-maroon-700 text-stone-700 dark:text-slate-300">
                ${s.partner_name}: ${formatRupiah(s.amount)}
              </span>
            `).join(" ")}
          </div>
        </div>
      `).join("");

      content.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 rounded-xl luxury-well flex items-baseline justify-between">
            <span class="text-xs text-stone-500 dark:text-slate-400">Total Modal Ditarik:</span>
            <span class="text-xl font-mono font-extrabold gold-metallic-text">${formatRupiah(board.total_capital)}</span>
          </div>

          <div>
            <h5 class="text-xs font-bold text-stone-800 dark:text-amber-200/80 mb-1.5">Pengembalian Modal 7 Pemodal:</h5>
            <div class="space-y-1.5">
              ${payoutsHtml}
            </div>
          </div>

          <div>
            <h5 class="text-xs font-bold text-stone-800 dark:text-amber-200/80 mb-1.5">Daftar Transaksi (${txs.length}):</h5>
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              ${txsHtml}
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    content.innerHTML = `<div class="text-center py-8 text-rose-500 text-xs">Gagal memuat rincian sesi.</div>`;
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

// ==================== SALES REVENUE & PROFIT (MODAL & INLINE CARD) ====================
let salesModalTargetDate = null;
let salesModalTargetCapLM = 0;
let salesModalTargetCapNonLM = 0;
let salesModalTargetCapital = 0;

function updateInlineSalesCalc() {
  const inLM = document.getElementById("inlineInputSalesLM");
  const inNonLM = document.getElementById("inlineInputSalesNonLM");
  const revLM = parseFloat(inLM ? inLM.value : 0) || 0;
  const revNonLM = parseFloat(inNonLM ? inNonLM.value : 0) || 0;

  const capLM = state.dailyBoard ? (state.dailyBoard.total_capital_lm || 0) : 0;
  const capNonLM = state.dailyBoard ? (state.dailyBoard.total_capital_non_lm || 0) : 0;
  const totalCap = state.dailyBoard ? (state.dailyBoard.total_capital || 0) : 0;

  const totalRev = revLM + revNonLM;
  const previewEl = document.getElementById("inlineProfitPreview");
  if (!previewEl) return;

  if (totalRev <= 0) {
    previewEl.innerHTML = `<span class="text-stone-400 dark:text-slate-400 font-normal italic text-[11px]">Masukkan angka jual LM dan Non-LM di atas</span>`;
    return;
  }

  const profitLM = revLM - capLM;
  const pctLM = capLM > 0 ? ((profitLM / capLM) * 100).toFixed(1) : "0";

  const profitNonLM = revNonLM - capNonLM;
  const pctNonLM = capNonLM > 0 ? ((profitNonLM / capNonLM) * 100).toFixed(1) : "0";

  const totalProfit = totalRev - totalCap;
  const totalPct = totalCap > 0 ? ((totalProfit / totalCap) * 100).toFixed(1) : "0";

  const pSign = totalProfit >= 0 ? "+" : "";
  const signLM = profitLM >= 0 ? "+" : "";
  const signNonLM = profitNonLM >= 0 ? "+" : "";

  previewEl.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span class="text-amber-800 dark:text-gold-300">🪙 LM: <strong>${signLM}${formatRupiah(profitLM)}</strong> (${signLM}${pctLM}%)</span>
      <span class="text-rose-800 dark:text-rose-300">💍 Non-LM: <strong>${signNonLM}${formatRupiah(profitNonLM)}</strong> (${signNonLM}${pctNonLM}%)</span>
      <span class="${totalProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-rose-600 dark:text-rose-400 font-extrabold'}">💎 Total: ${pSign}${formatRupiah(totalProfit)} (${pSign}${totalPct}%)</span>
    </div>
  `;
}

function addInlineSalesField(fieldId, val) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const cur = parseFloat(input.value) || 0;
  input.value = cur + val;
  updateInlineSalesCalc();
}

async function saveInlineSales() {
  const inLM = document.getElementById("inlineInputSalesLM");
  const inNonLM = document.getElementById("inlineInputSalesNonLM");
  const revLM = parseFloat(inLM ? inLM.value : 0) || 0;
  const revNonLM = parseFloat(inNonLM ? inNonLM.value : 0) || 0;

  if (revLM <= 0 && revNonLM <= 0) {
    showToast("Nominal hasil penjualan LM atau Non-LM belum diisi!", false);
    if (inLM) inLM.focus();
    return;
  }

  try {
    const res = await fetch("/api/v1/day/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sales_revenue_lm: revLM,
        sales_revenue_non_lm: revNonLM,
        sales_revenue: revLM + revNonLM,
        sales_notes: "Input penjualan kasir sore (LM & Non-LM)"
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || "Hasil penjualan LM & Non-LM berhasil disimpan!");
      await loadAllData();
    } else {
      showToast(data.detail || "Gagal menyimpan hasil jual", false);
    }
  } catch (err) {
    showToast("Gagal menghubungi server", false);
  }
}

async function openSalesModal(dateStr = null) {
  if (!dateStr) {
    const inlineInput = document.getElementById("inlineInputSalesLM");
    if (inlineInput) {
      inlineInput.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => inlineInput.focus(), 300);
    }
  }

  const modal = document.getElementById("modalSales");
  if (!modal) return;

  salesModalTargetDate = dateStr;
  let revLM = 0;
  let revNonLM = 0;
  let notes = "";
  let capLM = 0;
  let capNonLM = 0;
  let totalCap = 0;

  if (dateStr) {
    const histItem = (state.historyList || []).find(h => h.date_str === dateStr);
    if (histItem) {
      totalCap = histItem.total_capital || 0;
      capLM = histItem.total_capital_lm || 0;
      capNonLM = histItem.total_capital_non_lm || 0;
      revLM = histItem.sales_revenue_lm || 0;
      revNonLM = histItem.sales_revenue_non_lm || 0;
      notes = histItem.sales_notes || "";
    } else {
      try {
        const res = await fetch(`/api/v1/history/${dateStr}`);
        const data = await res.json();
        if (data.success && data.data && data.data.board) {
          const b = data.data.board;
          totalCap = b.total_capital || 0;
          capLM = b.total_capital_lm || 0;
          capNonLM = b.total_capital_non_lm || 0;
          revLM = b.sales_revenue_lm || 0;
          revNonLM = b.sales_revenue_non_lm || 0;
          notes = b.sales_notes || "";
        }
      } catch (e) {}
    }
  } else {
    if (state.dailyBoard) {
      const b = state.dailyBoard;
      salesModalTargetDate = b.day_date;
      totalCap = b.total_capital || 0;
      capLM = b.total_capital_lm || 0;
      capNonLM = b.total_capital_non_lm || 0;
      revLM = b.sales_revenue_lm || 0;
      revNonLM = b.sales_revenue_non_lm || 0;
      notes = b.sales_notes || "";
    }
  }

  salesModalTargetCapital = totalCap;
  salesModalTargetCapLM = capLM;
  salesModalTargetCapNonLM = capNonLM;

  const targetCapEl = document.getElementById("modalInputTargetCapital");
  if (targetCapEl) targetCapEl.textContent = formatRupiah(totalCap);

  const targetCapLMEl = document.getElementById("modalTargetCapLM");
  if (targetCapLMEl) targetCapLMEl.textContent = `Modal LM: ${formatRupiah(capLM)}`;

  const targetCapNonLMEl = document.getElementById("modalTargetCapNonLM");
  if (targetCapNonLMEl) targetCapNonLMEl.textContent = `Modal Non-LM: ${formatRupiah(capNonLM)}`;

  const inputLM = document.getElementById("modalSalesLM");
  if (inputLM) inputLM.value = revLM > 0 ? revLM : "";

  const inputNonLM = document.getElementById("modalSalesNonLM");
  if (inputNonLM) inputNonLM.value = revNonLM > 0 ? revNonLM : "";

  const notesInput = document.getElementById("inputSalesNotes");
  if (notesInput) notesInput.value = notes || "";

  updateSalesCalculationPreview();
  modal.style.display = "flex";
  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeSalesModal() {
  const modal = document.getElementById("modalSales");
  if (modal) {
    modal.style.display = "none";
    modal.classList.add("hidden");
  }
}

function addModalSalesField(fieldId, val) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const current = parseFloat(input.value) || 0;
  input.value = current + val;
  updateSalesCalculationPreview();
}

function updateSalesCalculationPreview() {
  const inLM = document.getElementById("modalSalesLM");
  const inNonLM = document.getElementById("modalSalesNonLM");
  const revLM = parseFloat(inLM ? inLM.value : 0) || 0;
  const revNonLM = parseFloat(inNonLM ? inNonLM.value : 0) || 0;
  const totalRev = revLM + revNonLM;

  const capLM = salesModalTargetCapLM;
  const capNonLM = salesModalTargetCapNonLM;
  const totalCap = salesModalTargetCapital;

  const profitLM = revLM - capLM;
  const pctLM = capLM > 0 ? ((profitLM / capLM) * 100).toFixed(1) : "0";
  const signLM = profitLM >= 0 ? "+" : "";

  const profitNonLM = revNonLM - capNonLM;
  const pctNonLM = capNonLM > 0 ? ((profitNonLM / capNonLM) * 100).toFixed(1) : "0";
  const signNonLM = profitNonLM >= 0 ? "+" : "";

  const totalProfit = totalRev - totalCap;
  const totalPct = totalCap > 0 ? ((totalProfit / totalCap) * 100).toFixed(1) : "0";
  const totalSign = totalProfit >= 0 ? "+" : "";

  const prevLM = document.getElementById("previewProfitLM");
  if (prevLM) {
    prevLM.textContent = `Laba LM: ${signLM}${formatRupiah(profitLM)} (${signLM}${pctLM}%)`;
    prevLM.className = profitLM >= 0 ? "text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold" : "text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold";
  }

  const prevNonLM = document.getElementById("previewProfitNonLM");
  if (prevNonLM) {
    prevNonLM.textContent = `Laba Non-LM: ${signNonLM}${formatRupiah(profitNonLM)} (${signNonLM}${pctNonLM}%)`;
    prevNonLM.className = profitNonLM >= 0 ? "text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold" : "text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold";
  }

  const prevTotal = document.getElementById("formattedSalesPreview");
  if (prevTotal) prevTotal.textContent = formatRupiah(totalRev);

  const profitResEl = document.getElementById("salesModalProfitResult");
  const profitPctEl = document.getElementById("salesModalProfitPct");

  if (profitResEl) {
    profitResEl.textContent = `${totalSign}${formatRupiah(totalProfit)}`;
    profitResEl.className = totalProfit >= 0 
      ? "text-base font-mono font-extrabold text-emerald-700 dark:text-emerald-400" 
      : "text-base font-mono font-extrabold text-rose-600 dark:text-rose-400";
  }
  if (profitPctEl) {
    profitPctEl.textContent = `(${totalSign}${totalPct}%)`;
    profitPctEl.className = totalProfit >= 0 
      ? "text-[10px] font-mono text-emerald-600 dark:text-emerald-300" 
      : "text-[10px] font-mono text-rose-600 dark:text-rose-300";
  }
}

async function saveSalesRevenue() {
  const inLM = document.getElementById("modalSalesLM");
  const inNonLM = document.getElementById("modalSalesNonLM");
  const revLM = parseFloat(inLM ? inLM.value : 0) || 0;
  const revNonLM = parseFloat(inNonLM ? inNonLM.value : 0) || 0;
  const totalRev = revLM + revNonLM;
  const notes = document.getElementById("inputSalesNotes")?.value?.trim() || "";

  if (totalRev <= 0) {
    showToast("Nominal hasil penjualan belum diisi!", false);
    return;
  }

  const queryDate = salesModalTargetDate ? `?date=${encodeURIComponent(salesModalTargetDate)}` : "";

  try {
    const res = await fetch(`/api/v1/day/sales${queryDate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sales_revenue: totalRev,
        sales_revenue_lm: revLM,
        sales_revenue_non_lm: revNonLM,
        sales_notes: notes
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || "Hasil penjualan & keuntungan berhasil disimpan!");
      closeSalesModal();
      await loadAllData();
      if (state.currentTab === "history") {
        await loadHistoryData();
      }
    } else {
      showToast(data.detail || "Gagal menyimpan hasil jual", false);
    }
  } catch (err) {
    showToast("Gagal menghubungi server", false);
  }
}

// ==================== SETTINGS (PARTNER MANAGEMENT & ADD PARTNER) ====================
function openSettingsModal() {
  const modal = document.getElementById("modalSettings");
  const container = document.getElementById("settingsPartnersList");
  if (!modal || !container) return;

  const count = state.partners.length;
  const titleEl = document.getElementById("modalSettingsTitle");
  if (titleEl) titleEl.textContent = `PENGATURAN PEMODAL EMAS (${count} Anggota)`;

  const countTextEl = document.getElementById("settingsPartnerCountText");
  if (countTextEl) countTextEl.textContent = `${count} Pemodal Aktif`;

  const newPartnerInput = document.getElementById("newPartnerName");
  if (newPartnerInput) newPartnerInput.value = "";

  container.innerHTML = state.partners.map(p => `
    <div class="flex items-center gap-2 luxury-well p-2.5 rounded-xl">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs shrink-0" style="background-color: ${p.color}25; color: ${p.color}; border: 1.5px solid ${p.color}50;">
        ${p.initials}
      </div>
      <input type="text" id="partnerNameInput_${p.id}" value="${p.name}" class="flex-1 bg-white dark:bg-maroon-900 border border-stone-300 dark:border-maroon-700 rounded-lg px-3 py-1.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400 font-bold" placeholder="Nama Pemodal">
      <button type="button" onclick="deletePartner(${p.id}, '${p.name}')" class="text-stone-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Hapus / Nonaktifkan Pemodal">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join("");

  modal.style.display = "flex";
  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
  const modal = document.getElementById("modalSettings");
  if (modal) {
    modal.style.display = "none";
    modal.classList.add("hidden");
  }
}

async function addNewPartner() {
  const input = document.getElementById("newPartnerName");
  const name = input ? input.value.trim() : "";
  if (!name) {
    showToast("Nama pemodal baru wajib diisi!", false);
    return;
  }

  try {
    const res = await fetch("/api/v1/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Pemodal ${name} berhasil ditambahkan!`);
      if (input) input.value = "";
      await loadAllData();
      openSettingsModal();
    } else {
      showToast(data.detail || "Gagal menambahkan pemodal", false);
    }
  } catch (err) {
    showToast("Gagal menyambung ke server", false);
  }
}

async function deletePartner(partnerId, partnerName) {
  if (!confirm(`Hapus / nonaktifkan pemodal "${partnerName}" dari sistem kasir?`)) return;

  try {
    const res = await fetch(`/api/v1/partners/${partnerId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || `Pemodal ${partnerName} berhasil dihapus.`);
      await loadAllData();
      openSettingsModal();
    } else {
      showToast(data.detail || "Gagal menghapus pemodal", false);
    }
  } catch (err) {
    showToast("Gagal menyambung ke server", false);
  }
}

async function saveAllPartnerSettings() {
  try {
    let updatedCount = 0;
    for (const p of state.partners) {
      const input = document.getElementById(`partnerNameInput_${p.id}`);
      if (input && input.value.trim() && input.value.trim() !== p.name) {
        await fetch(`/api/v1/partners/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.value.trim() })
        });
        updatedCount++;
      }
    }
    closeSettingsModal();
    showToast(updatedCount > 0 ? "Nama-nama pemodal berhasil diperbarui!" : "Tidak ada perubahan nama.");
    loadAllData();
  } catch (err) {
    showToast("Gagal menyimpan nama pemodal", false);
  }
}

// Global browser window exports for event handlers
window.toggleTheme = toggleTheme;
window.setGoldCategory = setGoldCategory;
window.addInlineSalesField = addInlineSalesField;
window.addModalSalesField = addModalSalesField;
window.openSalesModal = openSalesModal;
window.closeSalesModal = closeSalesModal;
window.saveSalesRevenue = saveSalesRevenue;
window.updateSalesCalculationPreview = updateSalesCalculationPreview;
window.saveInlineSales = saveInlineSales;
window.updateInlineSalesCalc = updateInlineSalesCalc;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.addNewPartner = addNewPartner;
window.deletePartner = deletePartner;
window.saveAllPartnerSettings = saveAllPartnerSettings;

// Boot application
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadAllData();
  if (window.lucide) lucide.createIcons();
});
