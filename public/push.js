(function () {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function setButtonState(btn, state) {
    btn.dataset.state = state;
    btn.disabled = false;
    if (state === "on") btn.textContent = "🔔 Đã bật thông báo trên máy này";
    else if (state === "denied") {
      btn.textContent = "🔕 Trình duyệt đang chặn thông báo";
      btn.disabled = true;
    } else btn.textContent = "🔔 Bật thông báo trên máy này";
  }

  async function init() {
    const btn = document.getElementById("push-toggle");
    if (!btn) return;

    const reg = await navigator.serviceWorker.register("/sw.js");
    const existing = await reg.pushManager.getSubscription();
    btn.style.display = "inline-flex";
    setButtonState(btn, Notification.permission === "denied" ? "denied" : existing ? "on" : "off");

    btn.addEventListener("click", async () => {
      if (btn.dataset.state === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setButtonState(btn, "off");
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setButtonState(btn, perm === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = await fetch("/api/push/vapid-public-key").then((r) => r.json());
      if (!publicKey) {
        alert("Máy chủ chưa cấu hình thông báo đẩy.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        alert("Không lưu được đăng ký thông báo trên máy chủ. Thử lại sau.");
        setButtonState(btn, "off");
        return;
      }
      setButtonState(btn, "on");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
