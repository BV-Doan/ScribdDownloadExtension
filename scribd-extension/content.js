// content.js - Runs on https://www.scribd.com/embeds/* pages
// This script is available for manual triggering via extension messaging.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_AUTOMATION") {
    runAutomation().then(() => {
      sendResponse({ status: "done" });
      chrome.runtime.sendMessage({ type: "SCRIBD_DONE" });
    });
    return true; // keep channel open for async
  }
});

function runAutomation() {
  return new Promise((resolve) => {
    const pageElements = document.querySelectorAll("[class*='page']");
    let index = 0;

    function scrollNext() {
      if (index < pageElements.length) {
        pageElements[index].scrollIntoView({ behavior: "smooth", block: "center" });
        index++;
        setTimeout(scrollNext, 300);
      } else {
        // Remove toolbars
        const toolbarTop = document.querySelector(".toolbar_top");
        if (toolbarTop) toolbarTop.parentNode.removeChild(toolbarTop);

        const toolbarBottom = document.querySelector(".toolbar_bottom");
        if (toolbarBottom) toolbarBottom.parentNode.removeChild(toolbarBottom);

        // Clear document_scroller class
        document.querySelectorAll(".document_scroller").forEach((el) => {
          el.setAttribute("class", "");
        });

        // Print
        setTimeout(() => {
          window.print();
          resolve();
        }, 1500);
      }
    }

    window.scrollTo(0, 0);
    setTimeout(scrollNext, 500);
  });
}
