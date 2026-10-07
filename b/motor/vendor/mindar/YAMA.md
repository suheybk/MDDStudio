# Bu klasördeki MindAR değiştirilmiştir

Kaynak: `mind-ar` 1.2.5 (npm, MIT lisansı). Three.js: 0.160.0.

`controller-mGt1s8dJ.js` içinde tek bir değişiklik var: kamera karesini griye çeviren
gölgelendirici, "mürekkep haritası" üreten bir sürümle değiştirildi.

- Özgün hâli: `gri = 0.299 R + 0.587 G + 0.114 B`
- Yamalı hâli: `gri = enParlakKanal / çevredeki en parlak değer` (5×5 örnek, 4 piksel aralık, taban 0.25)

Neden: boyanmış sayfada renkli alanlar gri tonlamada koyulaşıp siyah çizgilerle karışıyor ve
sayfa tanınmıyor. Yamalı sürümde boyalı alan "kâğıt" gibi açık, çizgi koyu kalıyor.

MindAR'ı güncellersen yamayı yeniden uygula:

    python3 gelistirici/yama.py b/motor/vendor/mindar/controller-XXXX.js 4.0 0.25

Yamayı geri almak için npm'deki özgün dosyayı bu klasöre kopyalaman yeterli.
