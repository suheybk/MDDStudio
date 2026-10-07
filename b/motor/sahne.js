// MDD Studio · Boyama AR — sahne (efekt) motoru
// sayfa.json içindeki "sahne" listesini Three.js nesnelerine çevirir.
// Koordinatlar: x ve y, sayfa görseli üzerinde 0–1 arası (sol üst köşe 0,0).
// Boyutlar: sayfa genişliğinin oranı (0.1 = sayfa genişliğinin onda biri).
import * as THREE from 'three';

const yumusak = (a) => (a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a));
const zipla = (a) => {
  if (a <= 0) return 0;
  if (a >= 1) return 1;
  const c = 1.70158;
  const b = a - 1;
  return 1 + (c + 1) * b * b * b + c * b * b;
};

function tuval(w, h, ciz) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  ciz(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _hale, _pirilti, _yildiz, _kenar;
function haleDoku() {
  return (_hale ||= tuval(128, 128, (g) => {
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    d.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d;
    g.fillRect(0, 0, 128, 128);
  }));
}
function piriltiDoku() {
  return (_pirilti ||= tuval(64, 64, (g) => {
    g.translate(32, 32);
    const d = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 4 : 30;
      const a = (i * Math.PI) / 4;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }));
}
function yildizDoku() {
  return (_yildiz ||= tuval(128, 128, (g) => {
    g.translate(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 30 : 58;
      const a = (i * Math.PI) / 8;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }));
}
// Kenarları yumuşayan dolu dikdörtgen: takip titrese de karartmanın kenarı sırıtmaz.
function kenarDoku() {
  return (_kenar ||= tuval(128, 128, (g) => {
    g.fillStyle = '#fff';
    g.filter = 'blur(2.5px)';
    g.fillRect(6, 6, 116, 116);
  }));
}

function etiketDoku(metin, sagdanSola) {
  const olc = document.createElement('canvas').getContext('2d');
  const yazi = '600 64px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", sans-serif';
  olc.font = yazi;
  const gen = Math.ceil(olc.measureText(metin).width) + 88;
  const yuk = 120;
  const doku = tuval(gen, yuk, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(3, 3, gen - 6, yuk - 6, (yuk - 6) / 2);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#111111';
    g.stroke();
    g.font = yazi;
    g.direction = sagdanSola ? 'rtl' : 'ltr';
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(metin, gen / 2, yuk / 2 + 4);
  });
  return { doku, oran: gen / yuk };
}

function duzlem(doku, renk, ekle) {
  const m = new THREE.MeshBasicMaterial({
    map: doku || null,
    color: new THREE.Color(renk || '#ffffff'),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  if (ekle) {
    // Işık ekleme: renk üst üste toplanır, tuvalin saydamlığına dokunulmaz.
    // (Hazır AdditiveBlending saydamlığı da artırır; kamera görüntüsünün üstünde sayfayı karartır.)
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.SrcAlphaFactor;
    m.blendDst = THREE.OneFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
}

function icinde(px, py, kose) {
  let ic = false;
  for (let i = 0, j = kose.length - 1; i < kose.length; j = i++) {
    const [xi, yi] = kose[i];
    const [xj, yj] = kose[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ic = !ic;
  }
  return ic;
}

// Her seferinde aynı dağılımı veren küçük rastgele sayı üreteci.
function tohumlu(s) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * @param {object} ayar   sayfa.json içeriği
 * @param {object} ortam  { temel: sayfa klasörü yolu, dil, olay(ad, veri) }
 * @returns {{grup: THREE.Group, guncelle(t:number, dt:number):void, oynat(durum:boolean):void, bitis:number}}
 */
export function sahneKur(ayar, ortam) {
  const oran = ayar.oran;
  const grup = new THREE.Group();
  const P = (x, y, z = 0) => new THREE.Vector3(x - 0.5, (0.5 - y) * oran, z);
  const metinSec = (m) => (typeof m === 'string' ? m : m[ortam.dil] || m.tr || Object.values(m)[0]);
  const parcalar = [];
  let sira = 0;
  let bitis = 0;
  let kandilNo = 0;
  let aktif = false;

  const ekle = (nesne) => {
    nesne.renderOrder = ++sira;
    nesne.traverse?.((n) => (n.renderOrder = sira));
    grup.add(nesne);
    return nesne;
  };

  for (const o of ayar.sahne || []) {
    const t0 = o.t ?? 0;
    bitis = Math.max(bitis, t0 + 1.5);

    if (o.tip === 'gece') {
      const m = ekle(duzlem(kenarDoku(), o.renk || '#0a1030'));
      m.scale.set(1.1, oran + 0.1, 1);
      const koyu = o.koyuluk ?? 0.55;
      parcalar.push((t) => {
        m.material.opacity = koyu * yumusak((t - t0) / (o.sure ?? 1.6));
      });
    } else if (o.tip === 'kandil') {
      const r = o.r ?? 0.07;
      const hale = ekle(duzlem(haleDoku(), o.renk || '#ffb347', true));
      const oz = ekle(duzlem(haleDoku(), '#fff3d0', true));
      hale.position.copy(P(o.x, o.y));
      oz.position.copy(P(o.x, o.y));
      const faz = (o.x * 37 + o.y * 91) % 6.28;
      let yandi = false;
      const no = kandilNo++;
      parcalar.push((t) => {
        const a = (t - t0) / 0.5;
        if (a > 0 && !yandi) {
          yandi = true;
          if (a < 1) ortam.olay?.('kandil', no);
        }
        if (a <= 0) yandi = false;
        const ac = yumusak(a);
        const parla = 1 + 0.9 * Math.max(0, 1 - Math.abs(a - 0.6) / 0.6); // yanarken kısa bir parlama
        const titre = 1 + 0.05 * Math.sin(t * 9 + faz) + 0.04 * Math.sin(t * 23.7 + faz * 2);
        hale.material.opacity = 0.85 * ac * titre;
        hale.scale.setScalar(r * 2.6 * parla * titre);
        oz.material.opacity = 0.9 * ac;
        oz.scale.setScalar(r * 0.8 * titre);
      });
    } else if (o.tip === 'nur') {
      const m = ekle(duzlem(haleDoku(), o.renk || '#ffe9a8', true));
      m.position.copy(P(o.x, o.y));
      parcalar.push((t) => {
        const ac = yumusak((t - t0) / (o.sure ?? 2));
        const nefes = 0.8 + 0.2 * Math.sin((t - t0) * 1.3);
        m.material.opacity = (o.guc ?? 0.9) * ac * nefes;
        m.scale.set(o.w * (0.96 + 0.04 * nefes), o.h * (0.96 + 0.04 * nefes), 1);
      });
    } else if (o.tip === 'parilti') {
      const rs = tohumlu(Math.round(o.x * 1000 + o.y * 7919 + 13) || 7);
      const kose = o.alan || [
        [o.x - o.w / 2, o.y - o.h / 2],
        [o.x + o.w / 2, o.y - o.h / 2],
        [o.x + o.w / 2, o.y + o.h / 2],
        [o.x - o.w / 2, o.y + o.h / 2],
      ];
      const xs = kose.map((k) => k[0]);
      const ys = kose.map((k) => k[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const adet = o.adet ?? 24;
      const boy = o.boy ?? 0.035;
      const taneler = [];
      let deneme = 0;
      while (taneler.length < adet && deneme++ < adet * 60) {
        const px = x0 + rs() * (x1 - x0);
        const py = y0 + rs() * (y1 - y0);
        if (!icinde(px, py, kose)) continue;
        const m = ekle(duzlem(piriltiDoku(), o.renk || '#ffe08a', true));
        m.position.copy(P(px, py));
        taneler.push({ m, faz: rs() * 6.28, hiz: 1.4 + rs() * 2.2, b: boy * (0.6 + rs() * 0.8) });
      }
      parcalar.push((t) => {
        const ac = yumusak((t - t0) / 1.2);
        for (const k of taneler) {
          const s = Math.max(0, Math.sin((t - t0) * k.hiz + k.faz));
          const g = s * s;
          k.m.material.opacity = ac * g;
          k.m.scale.setScalar(k.b * (0.5 + 0.7 * g));
          k.m.rotation.z = (t - t0) * 0.4 + k.faz;
        }
      });
    } else if (o.tip === 'yildiz') {
      const m = ekle(duzlem(yildizDoku(), o.renk || '#ffd166', true));
      const hale = ekle(duzlem(haleDoku(), o.renk || '#ffd166', true));
      m.position.copy(P(o.x, o.y));
      hale.position.copy(P(o.x, o.y));
      const r = o.r ?? 0.05;
      parcalar.push((t) => {
        const ac = yumusak((t - t0) / 0.8);
        const nabiz = 1 + 0.08 * Math.sin((t - t0) * 2.2 + o.x * 9);
        m.material.opacity = 0.9 * ac;
        m.scale.setScalar(r * 2 * zipla((t - t0) / 0.8) * nabiz);
        m.rotation.z = (t - t0) * (o.hiz ?? 0.5);
        hale.material.opacity = 0.5 * ac;
        hale.scale.setScalar(r * 4.2 * nabiz);
      });
    } else if (o.tip === 'etiket') {
      const metin = metinSec(o.metin);
      const { doku, oran: eo } = etiketDoku(metin, ortam.dil === 'ar');
      const boy = o.boy ?? 0.062;
      const uc = P(o.x, o.y);
      const yer = P(o.ex ?? o.x, o.ey ?? o.y - 0.08);
      const fark = yer.clone().sub(uc);
      const cizgi = ekle(duzlem(null, '#ffffff'));
      cizgi.position.copy(uc).addScaledVector(fark, 0.5);
      cizgi.rotation.z = Math.atan2(fark.y, fark.x);
      const nokta = ekle(new THREE.Mesh(new THREE.CircleGeometry(1, 24), cizgi.material.clone()));
      nokta.position.copy(uc);
      const kutu = ekle(duzlem(doku, '#ffffff'));
      kutu.position.copy(yer);
      kutu.userData.etiket = { metin, ses: o.ses || null };
      parcalar.push((t) => {
        const a = (t - t0) / 0.55;
        const ac = yumusak(a);
        cizgi.material.opacity = 0.95 * ac;
        cizgi.scale.set(Math.max(1e-4, fark.length() * ac), 0.006, 1);
        cizgi.position.copy(uc).addScaledVector(fark, 0.5 * ac);
        nokta.material.opacity = ac;
        nokta.scale.setScalar(0.012 * zipla(a));
        kutu.material.opacity = yumusak(a - 0.4);
        const s = Math.max(1e-4, zipla(a - 0.4));
        kutu.scale.set(boy * eo * s, boy * s, 1);
      });
      bitis = Math.max(bitis, t0 + 2);
    } else if (o.tip === 'video') {
      // Sayfanın üstünde oynayan video. "karisim":"ekle" siyah zeminli ışık videoları içindir:
      // siyah kısımlar görünmez olur, çocuğun boyaması altta kalır.
      const v = document.createElement('video');
      v.src = ortam.temel + o.src;
      v.loop = o.dongu ?? true;
      v.muted = o.sessiz ?? true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.crossOrigin = 'anonymous';
      v.preload = 'auto';
      const doku = new THREE.VideoTexture(v);
      doku.colorSpace = THREE.SRGBColorSpace;
      const m = ekle(duzlem(doku, '#ffffff', o.karisim === 'ekle'));
      m.position.copy(P(o.x ?? 0.5, o.y ?? 0.5));
      m.scale.set(o.w ?? 1, o.h ?? oran, 1);
      grup.userData.videolar = [...(grup.userData.videolar || []), { v, t0 }];
      parcalar.push((t) => {
        m.material.opacity = (o.guc ?? 1) * yumusak((t - t0) / 0.8);
      });
    } else if (o.tip === 'model') {
      // GLB biçiminde 3B model; sayfadan yukarı doğru "yükselir".
      const tasiyici = new THREE.Group();
      tasiyici.position.copy(P(o.x, o.y, o.z ?? 0));
      tasiyici.scale.setScalar(1e-4);
      sira++;
      grup.add(tasiyici);
      if (!grup.userData.isik) {
        grup.userData.isik = true;
        grup.add(new THREE.HemisphereLight('#ffffff', '#8a7a66', 2.2));
        const gunes = new THREE.DirectionalLight('#ffffff', 2.4);
        gunes.position.set(0.6, 0.8, 1.5);
        grup.add(gunes);
      }
      let karistirici = null;
      import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
        new GLTFLoader().load(
          ortam.temel + o.src,
          (g) => {
            if (o.dik ?? true) g.scene.rotation.x = Math.PI / 2; // modelin "yukarı"sı sayfadan dışarı baksın
            tasiyici.add(g.scene);
            if (g.animations.length) {
              karistirici = new THREE.AnimationMixer(g.scene);
              g.animations.forEach((k) => karistirici.clipAction(k).play());
            }
            ortam.olay?.('model-hazir', o.src);
          },
          undefined,
          (h) => ortam.olay?.('hata', 'Model yüklenemedi: ' + o.src + ' — ' + (h?.message || h))
        );
      });
      parcalar.push((t, dt) => {
        const s = (o.olcek ?? 0.3) * zipla((t - t0) / 1.1);
        tasiyici.scale.setScalar(Math.max(1e-4, s));
        if (o.don) tasiyici.rotation.z = (t - t0) * o.don;
        karistirici?.update(dt);
      });
    } else {
      ortam.olay?.('hata', 'Bilinmeyen sahne tipi: ' + o.tip);
    }
  }

  return {
    grup,
    bitis,
    guncelle(t, dt) {
      for (const p of parcalar) p(t, dt);
      if (aktif) {
        for (const { v, t0 } of grup.userData.videolar || []) {
          if (t >= t0 && v.paused && !v.ended) v.play().catch(() => {});
        }
      }
    },
    // Sayfa görünürken true, kaybolunca false: videolar buna göre oynar/durur.
    oynat(durum) {
      aktif = durum;
      if (!durum) for (const { v } of grup.userData.videolar || []) v.pause();
    },
    // Başla düğmesine basıldığı anda çağrılır: iOS videoyu ancak kullanıcı dokunuşuyla başlatır.
    kilidiAc() {
      for (const { v } of grup.userData.videolar || []) {
        v.play().then(() => v.pause()).catch(() => {});
      }
    },
    etiketler() {
      return grup.children.filter((n) => n.userData.etiket);
    },
  };
}
