// popup.js

function convertScribdLink(url) {
  const match = url.match(/https:\/\/www\.scribd\.com\/document\/(\d+)/);
  if (match) {
    return `https://www.scribd.com/embeds/${match[1]}/content`;
  }
  return null;
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

document.getElementById("startBtn").addEventListener("click", () => {
  const url = document.getElementById("scribdUrl").value.trim();
  if (!url) {
    setStatus("⚠️ Vui lòng nhập link Scribd!", "error");
    return;
  }

  const embedUrl = convertScribdLink(url);
  if (!embedUrl) {
    setStatus("❌ Link không hợp lệ!\nVí dụ: https://www.scribd.com/document/123456/ten-tai-lieu", "error");
    return;
  }

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stepsBox").style.display = "block";
  setStatus("🔄 Đang mở tab Scribd...", "info");
  setStep(1, "active");
  setProgress(10);

  // Gửi tới background để xử lý (background sẽ dùng port để gửi lại progress)
  chrome.runtime.sendMessage({ type: "START_DOWNLOAD", embedUrl });
});

document.getElementById("openTabBtn").addEventListener("click", () => {
  const url = document.getElementById("scribdUrl").value.trim();
  if (!url) {
    setStatus("⚠️ Vui lòng nhập link Scribd trước!", "error");
    return;
  }
  const embedUrl = convertScribdLink(url);
  if (!embedUrl) {
    setStatus("❌ Link không hợp lệ!", "error");
    return;
  }
  chrome.tabs.create({ url: embedUrl });
  setStatus("🔗 Đã mở tab embed.", "info");
});
