// MDD Studio · Boyama AR — sayfa motoru
// Her boyama sayfasının klasöründeki index.html bu dosyayı çağırır; gerisini sayfa.json belirler.
//   /b/m12/            → kamera ile AR
//   /b/m12/?onizleme   → kamerasız önizleme (masaüstünde tasarım yaparken ve kamera izni yokken)
//   /b/m12/?dil=en     → dili elle seç (tr, en, ar, id)
import * as THREE from 'three';
import { sahneKur } from './sahne.js';

const MOTOR = new URL('.', import.meta.url).pathname; // .../b/motor/
const SAYFA = (() => {
  let p = location.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  return p;
})();
const sorgu = new URLSearchParams(location.search);

const METIN = {
  tr: {
    basla: 'Kamerayı aç',
    kamerasiz: 'Kamerasız izle',
    nasil: 'Telefonu boyama sayfasına tut. Sayfanın tamamı ekrana sığsın.',
    hazir: 'Hazırlanıyor…',
    tara: 'Sayfanın tamamını kadraja al',
    kameraYok: 'Kamera açılamadı. Tarayıcıdan kamera iznini verip sayfayı yenileyebilir ya da kamerasız izleyebilirsin.',
    uygulamaIci: 'Kamera bu pencerede çalışmıyor olabilir. Bağlantıyı Safari ya da Chrome’da aç.',
    foto: 'Fotoğraf çek',
    ses: 'Ses',
    tekrar: 'Baştan oynat',
    yuklenemedi: 'Sayfa yüklenemedi.',
    kaydedildi: 'Fotoğraf hazır',
  },
  en: {
    basla: 'Open camera',
    kamerasiz: 'Watch without camera',
    nasil: 'Point your phone at the colouring page. Keep the whole page in view.',
    hazir: 'Getting ready…',
    tara: 'Fit the whole page in the frame',
    kameraYok: 'The camera could not be opened. Allow camera access and reload, or watch without the camera.',
    uygulamaIci: 'The camera may not work in this window. Open the link in Safari or Chrome.',
    foto: 'Take photo',
    ses: 'Sound',
    tekrar: 'Play again',
    yuklenemedi: 'The page could not be loaded.',
    kaydedildi: 'Photo ready',
  },
  ar: {
    basla: 'افتح الكاميرا',
    kamerasiz: 'شاهد بدون كاميرا',
    nasil: 'وجّه الهاتف نحو صفحة التلوين واجعل الصفحة كلها ظاهرة.',
    hazir: 'جارٍ التحضير…',
    tara: 'اجعل الصفحة كلها داخل الإطار',
    kameraYok: 'تعذّر فتح الكاميرا. اسمح باستخدام الكاميرا ثم أعد تحميل الصفحة، أو شاهد بدون كاميرا.',
    uygulamaIci: 'قد لا تعمل الكاميرا في هذه النافذة. افتح الرابط في Safari أو Chrome.',
    foto: 'التقط صورة',
    ses: 'الصوت',
    tekrar: 'أعد التشغيل',
    yuklenemedi: 'تعذّر تحميل الصفحة.',
    kaydedildi: 'الصورة جاهزة',
  },
  id: {
    basla: 'Buka kamera',
    kamerasiz: 'Tonton tanpa kamera',
    nasil: 'Arahkan ponsel ke halaman mewarnai. Pastikan seluruh halaman terlihat.',
    hazir: 'Menyiapkan…',
    tara: 'Masukkan seluruh halaman ke dalam bingkai',
    kameraYok: 'Kamera tidak dapat dibuka. Izinkan akses kamera lalu muat ulang, atau tonton tanpa kamera.',
    uygulamaIci: 'Kamera mungkin tidak berfungsi di jendela ini. Buka tautan di Safari atau Chrome.',
    foto: 'Ambil foto',
    ses: 'Suara',
    tekrar: 'Putar ulang',
    yuklenemedi: 'Halaman tidak dapat dimuat.',
    kaydedildi: 'Foto siap',
  },
};
const dil = (() => {
  const d = (sorgu.get('dil') || navigator.language || 'tr').slice(0, 2).toLowerCase();
  return METIN[d] ? d : 'tr';
})();
const M = METIN[dil];
const sec = (m) => (m == null ? '' : typeof m === 'string' ? m : m[dil] || m.tr || Object.values(m)[0]);

document.documentElement.lang = dil;
document.documentElement.dir = dil === 'ar' ? 'rtl' : 'ltr';
if (!document.querySelector('link[data-ar]')) {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = MOTOR + 'ar.css';
  l.dataset.ar = '1';
  document.head.appendChild(l);
}

const el = (etiket, sinif, ic) => {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (ic != null) e.textContent = ic;
  return e;
};
const IKON = {
  foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.3" r="3.4"/></svg>',
  sesAcik: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>',
  sesKapali: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
  tekrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1"/><path d="M5 4.5v4h4"/></svg>',
};

// ---------- arayüz ----------
const kok = el('div', 'ar-kok');
const sahneKap = el('div', 'ar-sahne');
const giris = el('div', 'ar-giris');
const ipucu = el('div', 'ar-ipucu');
const uyari = el('div', 'ar-uyari');
const dugmeler = el('div', 'ar-dugmeler');
kok.append(sahneKap, ipucu, uyari, dugmeler, giris);
document.body.appendChild(kok);

function dugme(ikon, ad, is) {
  const d = el('button', 'ar-dugme');
  d.type = 'button';
  d.innerHTML = IKON[ikon];
  d.setAttribute('aria-label', ad);
  d.title = ad;
  d.addEventListener('click', is);
  dugmeler.appendChild(d);
  return d;
}
function ipucuGoster(metin) {
  ipucu.textContent = metin || '';
  ipucu.classList.toggle('acik', !!metin);
}
function uyariGoster(metin, kalici) {
  uyari.textContent = metin || '';
  uyari.classList.toggle('acik', !!metin);
  clearTimeout(uyariGoster.z);
  if (metin && !kalici) uyariGoster.z = setTimeout(() => uyari.classList.remove('acik'), 4000);
}

// ---------- ses ----------
let sesAcik = true;
let sesOrtam = null;
let anlatim = null; // sayfa.json → "ses"
let anlatimCaldi = false;
const NOTALAR = [523.25, 659.25, 783.99, 1046.5, 880, 698.46];
function cin(no) {
  if (!sesAcik || !sesOrtam) return;
  const t = sesOrtam.currentTime;
  const o = sesOrtam.createOscillator();
  const k = sesOrtam.createGain();
  o.type = 'sine';
  o.frequency.value = NOTALAR[no % NOTALAR.length];
  k.gain.setValueAtTime(0.0001, t);
  k.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
  k.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(k).connect(sesOrtam.destination);
  o.start(t);
  o.stop(t + 1.2);
}
function sesKilidiAc(ayar) {
  try {
    sesOrtam = new (window.AudioContext || window.webkitAudioContext)();
    sesOrtam.resume?.();
  } catch {}
  if (ayar.ses?.src) {
    anlatim = new Audio(SAYFA + sec(ayar.ses.src));
    anlatim.preload = 'auto';
    anlatim.play().then(() => { anlatim.pause(); anlatim.currentTime = 0; }).catch(() => {});
  }
}
function oku(metin, ses) {
  if (!sesAcik) return;
  if (ses) return void new Audio(SAYFA + sec(ses)).play().catch(() => {});
  if (!('speechSynthesis' in window)) return;
  const s = new SpeechSynthesisUtterance(metin);
  s.lang = { tr: 'tr-TR', en: 'en-US', ar: 'ar-SA', id: 'id-ID' }[dil];
  s.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(s);
}

// ---------- ortak sahne döngüsü ----------
function oynatici(ayar) {
  const sahne = sahneKur(ayar, {
    temel: SAYFA,
    dil,
    olay(ad, veri) {
      if (ad === 'kandil') cin(veri);
      if (ad === 'hata') { console.warn(veri); if (sorgu.has('onizleme')) uyariGoster(String(veri)); } // uyarı yalnızca önizlemede görünür
    },
  });
  let t = 0;
  let son = performance.now();
  let gorunur = false;
  return {
    sahne,
    gorunurluk(d) {
      gorunur = d;
      sahne.oynat(d);
      if (!d) anlatim?.pause();
      else if (anlatim && anlatimCaldi && !anlatim.ended && sesAcik) anlatim.play().catch(() => {});
    },
    bastan() {
      t = 0;
      anlatimCaldi = false;
      if (anlatim) { anlatim.pause(); anlatim.currentTime = 0; }
    },
    kare() {
      const simdi = performance.now();
      const dt = Math.min(0.1, (simdi - son) / 1000);
      son = simdi;
      if (gorunur) t += dt;
      sahne.guncelle(t, dt);
      if (gorunur && anlatim && !anlatimCaldi && t >= (ayar.ses.t ?? sahne.bitis)) {
        anlatimCaldi = true;
        if (sesAcik) anlatim.play().catch(() => {});
      }
      kok.dataset.t = t.toFixed(1);
    },
  };
}

function etiketDokunma(tuval, kamera, sahne) {
  const isin = new THREE.Raycaster();
  tuval.addEventListener('pointerdown', (e) => {
    const k = tuval.getBoundingClientRect();
    const n = new THREE.Vector2(((e.clientX - k.left) / k.width) * 2 - 1, -((e.clientY - k.top) / k.height) * 2 + 1);
    isin.setFromCamera(n, kamera);
    const v = isin.intersectObjects(sahne.etiketler(), false)[0];
    if (v && v.object.material.opacity > 0.5) oku(v.object.userData.etiket.metin, v.object.userData.etiket.ses);
  });
}

// ---------- fotoğraf ----------
async function fotoCek(ciz, katmanlar) {
  ciz(); // WebGL tamponu yalnızca çizimin hemen ardından okunabilir
  const k = sahneKap.getBoundingClientRect();
  const o = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.round(k.width * o);
  c.height = Math.round(k.height * o);
  const g = c.getContext('2d');
  g.scale(o, o);
  g.fillStyle = '#000';
  g.fillRect(0, 0, k.width, k.height);
  for (const n of katmanlar) {
    if (!n) continue;
    const b = n.getBoundingClientRect();
    g.drawImage(n, b.left - k.left, b.top - k.top, b.width, b.height);
  }
  g.font = '600 15px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillStyle = 'rgba(0,0,0,.55)';
  const yazi = 'MDD Studio · mddstudio.co';
  const w = g.measureText(yazi).width;
  g.fillRect(k.width - w - 28, k.height - 40, w + 28, 40);
  g.fillStyle = '#fff';
  g.fillText(yazi, k.width - 14, k.height - 15);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const dosya = new File([blob], 'mdd-boyama.jpg', { type: 'image/jpeg' });
  kok.dataset.foto = blob.size;
  if (navigator.canShare?.({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya] }); return; } catch (h) { if (h.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dosya.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  uyariGoster(M.kaydedildi);
}

function ortakDugmeler(o, ciz, katmanlar) {
  dugmeler.replaceChildren();
  dugme('foto', M.foto, () => fotoCek(ciz, katmanlar()));
  const s = dugme('sesAcik', M.ses, () => {
    sesAcik = !sesAcik;
    s.innerHTML = IKON[sesAcik ? 'sesAcik' : 'sesKapali'];
    if (!sesAcik) { anlatim?.pause(); window.speechSynthesis?.cancel(); }
  });
  dugme('tekrar', M.tekrar, () => o.bastan());
  dugmeler.classList.add('acik');
}

// ---------- kamerasız önizleme ----------
async function onizleme(ayar, o = oynatici(ayar)) {
  kok.dataset.mod = 'onizleme';
  const cizici = new THREE.WebGLRenderer({ antialias: true });
  cizici.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  cizici.setClearColor('#ecebe7');
  sahneKap.replaceChildren(cizici.domElement);
  const sahne3 = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
  const doku = await new THREE.TextureLoader().loadAsync(SAYFA + (ayar.gorsel || 'sayfa.png'));
  doku.colorSpace = THREE.SRGBColorSpace;
  doku.anisotropy = 8;
  const kagit = new THREE.Mesh(new THREE.PlaneGeometry(1, ayar.oran), new THREE.MeshBasicMaterial({ map: doku }));
  sahne3.add(kagit);
  sahne3.add(o.sahne.grup);
  const boyut = () => {
    const w = sahneKap.clientWidth;
    const h = sahneKap.clientHeight;
    cizici.setSize(w, h);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
  };
  boyut();
  window.addEventListener('resize', boyut);
  const basla = performance.now();
  const ciz = () => {
    const s = (performance.now() - basla) / 1000;
    // Sayfa tamamen sığsın: dar ekranda genişliğe, geniş ekranda yüksekliğe göre uzaklaş.
    const yari = Math.tan((kamera.fov * Math.PI) / 360);
    const uzak = Math.max((ayar.oran * 0.56) / yari, 0.56 / (yari * kamera.aspect)) + 0.1;
    kamera.position.set(Math.sin(s * 0.45) * 0.22, -0.3 + Math.cos(s * 0.33) * 0.08, uzak);
    kamera.lookAt(0, 0, 0);
    o.kare();
    cizici.render(sahne3, kamera);
  };
  cizici.setAnimationLoop(ciz);
  o.gorunurluk(true);
  etiketDokunma(cizici.domElement, kamera, o.sahne);
  ortakDugmeler(o, ciz, () => [cizici.domElement]);
  kok.dataset.durum = 'bulundu';
}

// ---------- kamera ile AR ----------
async function arBaslat(ayar, o) {
  kok.dataset.mod = 'ar';
  ipucuGoster(M.hazir);
  const { MindARThree } = await import('./vendor/mindar/mindar-image-three.prod.js');
  const mindar = new MindARThree({
    container: sahneKap,
    imageTargetSrc: SAYFA + (ayar.hedef || 'hedef.mind'),
    maxTrack: 1,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
    // Takip ayarları (sayfa.json → "takip"). Verilmezse MindAR'ın kendi varsayılanları kullanılır.
    filterMinCF: ayar.takip?.minCF ?? null, // küçültülürse titreme azalır, gecikme artar (varsayılan 0.001)
    filterBeta: ayar.takip?.beta ?? null, //   küçültülürse hareket yumuşar, gecikme artar (varsayılan 1000)
    warmupTolerance: ayar.takip?.isinma ?? null, // sahne görünmeden önce art arda kaç kare tutmalı (varsayılan 5)
    missTolerance: ayar.takip?.kayip ?? 10, //      kaç kare kaybolursa sahne gizlensin (MindAR varsayılanı 5)
  });
  const { renderer, scene, camera } = mindar;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const capa = mindar.addAnchor(0);
  capa.group.add(o.sahne.grup);
  capa.onTargetFound = () => {
    kok.dataset.durum = 'bulundu';
    ipucuGoster('');
    o.gorunurluk(true);
  };
  capa.onTargetLost = () => {
    kok.dataset.durum = 'araniyor';
    ipucuGoster(M.tara);
    o.gorunurluk(false);
  };
  await mindar.start();
  kok.dataset.durum = 'araniyor';
  ipucuGoster(M.tara);
  const ciz = () => {
    o.kare();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(ciz);
  etiketDokunma(renderer.domElement, camera, o.sahne);
  ortakDugmeler(o, ciz, () => [mindar.video, renderer.domElement]);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { anlatim?.pause(); window.speechSynthesis?.cancel(); }
  });
}

// ---------- giriş ----------
async function ana() {
  let ayar;
  try {
    const y = await fetch(SAYFA + 'sayfa.json', { cache: 'no-cache' });
    if (!y.ok) throw new Error(y.status);
    ayar = await y.json();
  } catch (h) {
    giris.append(el('p', 'ar-not', M.yuklenemedi));
    console.error(h);
    return;
  }
  document.title = sec(ayar.baslik) + ' · MDD Studio';

  if (sorgu.has('onizleme')) {
    giris.remove();
    await onizleme(ayar);
    return;
  }

  const kutu = el('div', 'ar-kart');
  const kucuk = el('img', 'ar-kucuk');
  kucuk.src = SAYFA + (ayar.gorsel || 'sayfa.png');
  kucuk.alt = '';
  const b = el('button', 'ar-basla', M.basla);
  b.type = 'button';
  const k = el('button', 'ar-ikincil', M.kamerasiz);
  k.type = 'button';
  kutu.append(el('div', 'ar-marka', 'MDD Studio'), kucuk, el('h1', 'ar-baslik', sec(ayar.baslik)), el('p', 'ar-not', M.nasil), b, k);
  if (/Instagram|FBAN|FBAV|Line\/|TikTok/i.test(navigator.userAgent)) kutu.append(el('p', 'ar-not ar-kucuk-not', M.uygulamaIci));
  giris.append(kutu);

  // Oynatıcı düğmeye basıldığı anda kurulur: iOS ses ve videoyu ancak dokunuş sırasında açtırır.
  const hazirla = () => {
    sesKilidiAc(ayar);
    const o = oynatici(ayar);
    o.sahne.kilidiAc();
    return o;
  };
  const kamerasiz = async (o, neden) => {
    giris.remove();
    sahneKap.replaceChildren();
    ipucuGoster('');
    await onizleme(ayar, o);
    if (neden) uyariGoster(neden, true);
  };
  k.addEventListener('click', () => kamerasiz(hazirla()));
  b.addEventListener('click', async () => {
    const o = hazirla();
    b.disabled = true;
    giris.classList.add('gizle');
    try {
      await arBaslat(ayar, o);
      giris.remove();
    } catch (h) {
      console.warn('AR başlatılamadı', h);
      await kamerasiz(o, M.kameraYok);
    }
  });
}
ana();
