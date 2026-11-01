/* Счётчик посетителей КХЛ SEASON 4.
   Подключается к сайту одной строкой в index.html. Если что-то пойдёт не так (нет интернета,
   база недоступна), сайт продолжит работать как обычно: ошибки счётчика на него не влияют. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const KEY_IGNORE = "khl_stats_ignore";      // "1" = не считать это устройство (включается на странице статистики)
const KEY_VISITOR = "khl_stats_vid";         // признак того, что этот браузер уже считался как человек
const KEY_INSTALLED = "khl_stats_installed"; // признак того, что установка приложения уже посчитана
const KEY_SESSION = "khl_stats_session";     // чтобы обновление страницы не считалось новым заходом

function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function ssSet(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
function rand(){ return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function today(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function start(){
  if (lsGet(KEY_IGNORE) === "1") return;

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const add = (path) => { set(ref(db, path), increment(1)).catch(() => {}); };

  // 1. Заход (один раз за сессию) + заход по дням + устройство + главная страница
  if (!ssGet(KEY_SESSION)){
    ssSet(KEY_SESSION, "1");
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 700;
    add("total/visits");
    add("daily/" + today());
    add("devices/" + (mobile ? "mobile" : "desktop"));
    add("pages/home");
  }

  // 2. Новый человек (по браузеру)
  if (!lsGet(KEY_VISITOR)){
    lsSet(KEY_VISITOR, rand());
    add("total/unique");
  }

  // 3. «Сейчас на сайте»: запись исчезает сама, когда человек закрывает сайт
  const meRef = ref(db, "online/" + rand());
  onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() === true){
      onDisconnect(meRef).remove().then(() => set(meRef, true)).catch(() => {});
    }
  });

  // 4. Какие разделы открывают и какой клуб выбирают любимым
  document.addEventListener("click", (e) => {
    const nav = e.target.closest && e.target.closest(".nav-btn");
    if (nav && nav.dataset.page) add("pages/" + nav.dataset.page);
    const pick = e.target.closest && e.target.closest(".club-pick-item");
    if (pick){
      const m = (pick.getAttribute("onclick") || "").match(/chooseFavoriteClub\('([^']+)'\)/);
      if (m) add("clubs/" + m[1]);
    }
  });

  // 5. Установка приложения (один раз на устройство)
  const markInstalled = () => {
    if (!lsGet(KEY_INSTALLED)){ lsSet(KEY_INSTALLED, "1"); add("total/installs"); }
  };
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (standalone) markInstalled();
  window.addEventListener("appinstalled", markInstalled);
}

try { start(); } catch (e) { /* счётчик не должен ломать сайт */ }
