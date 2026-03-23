// background.js - Service Worker

let popupPorts = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupPorts.push(port);
    port.onDisconnect.addListener(() => {
      popupPorts = popupPorts.filter(p => p !== port);
    });
  }
});

function sendProgress(data) {
  popupPorts.forEach(p => {
    try { p.postMessage(data); } catch(e) {}
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_DOWNLOAD") {
    handleDownload(msg.embedUrl);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "CLEAR_COOKIES") {
    clearScribdCookies().then(count => {
      sendResponse({ count });
    });
    return true; // async response
  }

  return false;
});

// ── Xóa toàn bộ cookies của scribd.com ──
async function clearScribdCookies() {
  const cookies = await chrome.cookies.getAll({ domain: ".scribd.com" });
  let count = 0;

  for (const cookie of cookies) {
    const protocol = cookie.secure ? "https" : "http";

    // 🔥 FIX: bỏ dấu chấm đầu domain
    const domain = cookie.domain.startsWith(".")
      ? cookie.domain.substring(1)
      : cookie.domain;

    const url = `${protocol}://${domain}${cookie.path}`;

    try {
      await chrome.cookies.remove({
        url,
        name: cookie.name,
        storeId: cookie.storeId // 🔥 thêm cái này cho chắc
      });
      count++;
    } catch (e) {
      console.log("Fail remove:", cookie.name, e);
    }
  }

  return count;
}

// ── Main automation ──
async function handleDownload(embedUrl) {
  sendProgress({ type: "PROGRESS", step: 1, state: "active", pct: 10, text: "🔄 Đang mở tab Scribd..." });

  const tab = await chrome.tabs.create({ url: embedUrl, active: true });
  const tabId = tab.id;

  await waitForTabLoad(tabId);
  sendProgress({ type: "PROGRESS", step: 1, state: "done", pct: 25, text: "✅ Tab đã mở xong!" });

  // Chờ JS Scribd render xong
  await sleep(2500);

  // Chấp nhận cookies banner nếu có
  await chrome.scripting.executeScript({
    target: { tabId },
    func: acceptCookiesBanner,
  });
  await sleep(800);

  // STEP 2: Scroll
  sendProgress({ type: "PROGRESS", step: 2, state: "active", pct: 35, text: "📄 Đang scroll qua tất cả trang..." });

  await chrome.scripting.executeScript({
    target: { tabId },
    func: scrollAllPages,
  });

  sendProgress({ type: "PROGRESS", step: 2, state: "done", pct: 60, text: "✅ Đã scroll xong!" });
  await sleep(1000);

  // STEP 3: Xóa toolbar
  sendProgress({ type: "PROGRESS", step: 3, state: "active", pct: 70, text: "🧹 Đang xóa toolbar..." });

  await chrome.scripting.executeScript({
    target: { tabId },
    func: removeToolbars,
  });

  sendProgress({ type: "PROGRESS", step: 3, state: "done", pct: 85, text: "✅ Đã dọn giao diện!" });
  await sleep(1000);

  // STEP 4: Print
  sendProgress({ type: "PROGRESS", step: 4, state: "active", pct: 92, text: "🖨️ Đang mở hộp thoại in..." });

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => { window.print(); },
  });

  await sleep(800);
  sendProgress({
    type: "PROGRESS", step: 4, state: "done", pct: 100,
    text: "✅ Hoàn tất! Chọn 'Save as PDF' trong hộp thoại in.",
    style: "success", done: true
  });
}

// ── Chờ tab load xong ──
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab && tab.status === "complete") { resolve(); return; }
      const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Inject functions ──

// Chấp nhận cookies banner (bấm "Save Preferences" hoặc "Reject Non-Essential")
function acceptCookiesBanner() {
  // Thử tìm nút "Save Preferences" trước
  const allButtons = Array.from(document.querySelectorAll("button"));
  const saveBtn = allButtons.find(b =>
    b.textContent.trim().toLowerCase().includes("save preferences")
  );
  if (saveBtn) { saveBtn.click(); return "saved"; }

  // Fallback: "Reject Non-Essential"
  const rejectBtn = allButtons.find(b =>
    b.textContent.trim().toLowerCase().includes("reject non-essential")
  );
  if (rejectBtn) { rejectBtn.click(); return "rejected"; }

  // Fallback: bất kỳ nút đóng banner nào
  const closeBtn = document.querySelector(
    "[class*='close'], [aria-label*='close'], [aria-label*='dismiss']"
  );
  if (closeBtn) { closeBtn.click(); return "closed"; }

  return "not_found";
}

function scrollAllPages() {
  return new Promise((resolve) => {
    window.scrollTo(0, 0);
    const pages = Array.from(document.querySelectorAll("[class*='page']"));
    let i = 0;
    function next() {
      if (i < pages.length) {
        pages[i].scrollIntoView({ behavior: "smooth", block: "center" });
        i++;
        setTimeout(next, 350);
      } else {
        resolve();
      }
    }
    setTimeout(next, 500);
  });
}

function removeToolbars() {
  const toolbarTop = document.querySelector(".toolbar_top");
  if (toolbarTop) toolbarTop.remove();

  const toolbarBottom = document.querySelector(".toolbar_bottom");
  if (toolbarBottom) toolbarBottom.remove();

  document.querySelectorAll(".document_scroller").forEach(el => {
    el.setAttribute("class", "");
  });
}
