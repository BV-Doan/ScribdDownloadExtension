// background.js - Service Worker
// Xử lý toàn bộ automation để popup đóng cũng không bị gián đoạn

// Lưu popup tab id để gửi progress updates
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
    try { p.postMessage(data); } catch(e) { /* popup đã đóng */ } 
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_DOWNLOAD") {
    handleDownload(msg.embedUrl);
    sendResponse({ ok: true });
  }
  return false;
});

async function handleDownload(embedUrl) {
  // STEP 1: Mở tab
  sendProgress({ type: "PROGRESS", step: 1, state: "active", pct: 10, text: "🔄 Đang mở tab Scribd..." });

  const tab = await chrome.tabs.create({ url: embedUrl, active: true });
  const tabId = tab.id;

  // Chờ tab load xong hoàn toàn
  await waitForTabLoad(tabId);

  sendProgress({ type: "PROGRESS", step: 1, state: "done", pct: 25, text: "✅ Tab đã mở xong!" });

  // Thêm delay để Scribd JS render xong
  await sleep(2500);

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

// Chờ tab load xong (status = complete)
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    // Kiểm tra nếu đã load xong rồi
    chrome.tabs.get(tabId, (tab) => {
      if (tab && tab.status === "complete") {
        resolve();
        return;
      }
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

// ---- Các hàm inject vào tab ----

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

