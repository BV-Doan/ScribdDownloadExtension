// popup.js

const SCRIBD_DOC_PATTERN = /https:\/\/www\.scribd\.com\/document\/(\d+)/;

function convertScribdLink(url) {
  const match = url.match(SCRIBD_DOC_PATTERN);
  if (match) return `https://www.scribd.com/embeds/${match[1]}/content`;
  return null;
}

function isScribdDocUrl(url) {
  return url && SCRIBD_DOC_PATTERN.test(url);
}

function setStatus(msg, type = "info") {
  const box = document.getElementById("statusBox");
  box.textContent = msg;
  box.className = `status ${type}`;
  box.style.display = "block";
}

function setStep(stepNum, state) {
  const el = document.getElementById(`step${stepNum}`);
  if (!el) return;
  el.className = `step ${state}`;
  el.querySelector(".step-num").textContent = state === "done" ? "✓" : stepNum;
}

function setProgress(pct) {
  document.getElementById("progressFill").style.width = pct + "%";
}

// Kết nối persistent port với background worker
const port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener((msg) => {
  if (msg.type === "PROGRESS") {
    if (msg.step) setStep(msg.step, msg.state);
    setProgress(msg.pct);
    setStatus(msg.text, msg.style || "info");
    if (msg.done) {
      document.getElementById("startBtn").disabled = false;
    }
  }
});

// ── Khởi động: kiểm tra tab hiện tại có phải Scribd không ──
async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && isScribdDocUrl(tab.url)) {
    const inputEl = document.getElementById("scribdUrl");
    const hintEl  = document.getElementById("autoFillHint");
    if (!inputEl.value || !convertScribdLink(inputEl.value)) {
      inputEl.value = tab.url;
      hintEl.style.display = "block";
    }
  }
}

checkCurrentTab();

// ── Nút "Bắt đầu tải" ──
document.getElementById("startBtn").addEventListener("click", async () => {
  let url = document.getElementById("scribdUrl").value.trim();

  // Nếu input trống / không hợp lệ → thử lấy link tab hiện tại
  if (!convertScribdLink(url)) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && isScribdDocUrl(tab.url)) {
      url = tab.url;
      document.getElementById("scribdUrl").value = url;
      document.getElementById("autoFillHint").style.display = "block";
    } else {
      setStatus("❌ Link không hợp lệ và tab hiện tại không phải Scribd!", "error");
      return;
    }
  }

  const embedUrl = convertScribdLink(url);
  if (!embedUrl) {
    setStatus("❌ Không thể chuyển đổi link. Kiểm tra lại định dạng!", "error");
    return;
  }

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stepsBox").style.display = "block";
  setStatus("🔄 Đang mở tab Scribd...", "info");
  setStep(1, "active");
  setProgress(10);

  chrome.runtime.sendMessage({ type: "START_DOWNLOAD", embedUrl });
});

// ── Nút "Mở tab embed" ──
document.getElementById("openTabBtn").addEventListener("click", async () => {
  let url = document.getElementById("scribdUrl").value.trim();
  if (!convertScribdLink(url)) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && isScribdDocUrl(tab.url)) url = tab.url;
  }
  const embedUrl = convertScribdLink(url);
  if (!embedUrl) {
    setStatus("❌ Link không hợp lệ!", "error");
    return;
  }
  chrome.tabs.create({ url: embedUrl });
  setStatus("🔗 Đã mở tab embed.", "info");
});

// ── Nút "Xóa cookies Scribd" ──
document.getElementById("clearCookiesBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_COOKIES" }, async (res) => {
  if (res && res.count !== undefined) {
    setStatus(`🍪 Đã xóa ${res.count} cookies của Scribd!`, "success");

    // 🔥 reload tab hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url.includes("scribd.com")) {
  chrome.tabs.reload(tab.id);
}

  } else {
    setStatus("⚠️ Không tìm thấy cookies nào để xóa.", "info");
  }
});
});

// ── Link tác giả: mở trong tab mới ──
document.getElementById("authorLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://github.com/BV-Doan" });
});
