// Uyumsoft e-Fatura / e-Arşiv entegrasyonu (SOAP "Integration" servisi, WS-Security kullanıcı adı/şifre).
// "_" ile başladığı için Pages bu dosyayı bir adres olarak yayınlamaz.
//
// Ortam değişkenleri:
//   UYUMSOFT_ENV       "live" → canlı servis; başka her değerde test servisi (kullanıcı/şifre: Uyumsoft/Uyumsoft)
//   UYUMSOFT_USER      web servis kullanıcı adı (Text)       — canlıda zorunlu
//   UYUMSOFT_PASSWORD  web servis şifresi (Secret)           — canlıda zorunlu
//   SELLER_*           (isteğe bağlı) faturadaki satıcı bilgilerini değiştirmek için; varsayılanlar aşağıdaki SELLER
//   INVOICE_SERIES     3 karakterli seri öneki (örn. MDD); boşsa Uyumsoft'un varsayılan e-arşiv internet serisi
//   SHIP_CARRIER_VKN, SHIP_CARRIER_NAME                     — kargo firması (internet satışı bilgisi)

const TEST_URL = "https://efaturaws-test.uyum.com.tr/Services/Integration";
const LIVE_URL = "https://edonusumapi.uyum.com.tr/Services/Integration";
const SELLER = {
  vkn: "2951167976", title: "DİDA Tasarım Ajansı Limited Şirketi", office: "Dışkapı",
  street: "Kuzey Ankara Camii Külliyesi, Şenyuva Mah. Şeyhan Cd. No:11 C D:16", district: "Keçiören", city: "Ankara",
  postal: "06300", phone: "+905334862899", email: "info@mddstudio.co", web: "https://mddstudio.co",
};
const TEST_VKN = "9000500394"; // Uyumsoft test hesabının (Uyumsoft/Uyumsoft) gönderici VKN'si

const x = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const r2 = n => (Math.round(n * 100) / 100).toFixed(2);

export function uyumConfig(env) {
  const live = env.UYUMSOFT_ENV === "live";
  return {
    live,
    url: live ? LIVE_URL : TEST_URL,
    user: live ? env.UYUMSOFT_USER : "Uyumsoft",
    pass: live ? env.UYUMSOFT_PASSWORD : "Uyumsoft",
    ready: !live || !!(env.UYUMSOFT_USER && env.UYUMSOFT_PASSWORD),
  };
}

async function soap(env, method, bodyXml) {
  const c = uyumConfig(env);
  if (!c.ready) throw new Error("Uyumsoft canlı bilgileri eksik");
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><o:UsernameToken><o:Username>${x(c.user)}</o:Username><o:Password>${x(c.pass)}</o:Password></o:UsernameToken></o:Security></s:Header><s:Body>${bodyXml}</s:Body></s:Envelope>`;
  const res = await fetch(c.url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"http://tempuri.org/IIntegration/${method}"` },
    body: envelope,
  });
  const text = await res.text();
  const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  if (fault) throw new Error(`Uyumsoft ${method}: ${fault[1]}`);
  const result = text.match(new RegExp(`<${method}Result\\b([^>]*?)(/>|>([\\s\\S]*?)</${method}Result>)`));
  if (!res.ok || !result) throw new Error(`Uyumsoft ${method}: HTTP ${res.status}`);
  const attrs = result[1], inner = result[3] || "";
  const ok = /IsSucceded="true"/.test(attrs);
  const msg = (attrs.match(/Message="([^"]*)"/) || [])[1] || "";
  if (!ok) throw new Error(`Uyumsoft ${method}: ${msg || "başarısız"}`);
  return { attrs, inner };
}

export async function isEInvoiceUser(env, vknTckn) {
  const { attrs } = await soap(env, "IsEInvoiceUser", `<IsEInvoiceUser xmlns="http://tempuri.org/"><vknTckn>${x(vknTckn)}</vknTckn><alias></alias></IsEInvoiceUser>`);
  return /Value="true"/.test(attrs);
}

// Siparişten UBL-TR e-Arşiv (internet satışı) faturası.
// order: { orderNo, uuid, buyer:{name,surname,email,phone,address,city,tckn?}, lines:[{n,q,p,kdv}], paidAt:Date, paymentType? }
// Satır fiyatları (p) KDV dâhil toplam tutardır; KDV oranı satır bazında (kdv, yüzde).
export function buildInvoiceXml(env, order) {
  const live = uyumConfig(env).live;
  // Satıcı (faturayı kesen) — DİDA Tasarım Ajansı; SELLER_* ortam değişkenleriyle değiştirilebilir.
  // Test ortamında VKN, Uyumsoft test hesabınınki olmak zorunda.
  const s = {
    vkn: env.SELLER_VKN || (live ? SELLER.vkn : TEST_VKN),
    title: env.SELLER_TITLE || SELLER.title,
    office: env.SELLER_TAX_OFFICE || SELLER.office,
    street: env.SELLER_STREET || SELLER.street, district: env.SELLER_DISTRICT || SELLER.district, city: env.SELLER_CITY || SELLER.city,
    postal: env.SELLER_POSTAL || SELLER.postal, phone: env.SELLER_PHONE || SELLER.phone, email: env.SELLER_EMAIL || SELLER.email,
    web: env.SELLER_WEB || SELLER.web,
  };
  const b = order.buyer;
  const now = order.paidAt || new Date();
  const tr = new Date(now.getTime() + 3 * 3600e3).toISOString(); // Türkiye saati (UTC+3)
  const issueDate = tr.slice(0, 10), issueTime = tr.slice(11, 19);

  // Satırlar: KDV dâhil tutardan matrah ve vergi
  const rows = order.lines.map((l, i) => {
    const rate = Number(l.kdv ?? 20);
    const gross = Number(l.p);
    const net = Math.round((gross / (1 + rate / 100)) * 100) / 100;
    const tax = Math.round((gross - net) * 100) / 100;
    return { i: i + 1, name: l.n, q: l.q, rate, net, tax, unit: Math.round((net / l.q) * 1e4) / 1e4 };
  });
  const byRate = {};
  for (const r of rows) { const t = byRate[r.rate] ||= { net: 0, tax: 0 }; t.net += r.net; t.tax += r.tax; }
  const totalNet = rows.reduce((a, r) => a + r.net, 0), totalTax = rows.reduce((a, r) => a + r.tax, 0);
  const cur = `currencyID="TRY"`;

  const party = (p) => `<cac:Party>${p.web ? `<cbc:WebsiteURI>${x(p.web)}</cbc:WebsiteURI>` : ""}<cac:PartyIdentification><cbc:ID schemeID="${p.id.length === 10 ? "VKN" : "TCKN"}">${x(p.id)}</cbc:ID></cac:PartyIdentification>${p.org ? `<cac:PartyName><cbc:Name>${x(p.org)}</cbc:Name></cac:PartyName>` : ""}<cac:PostalAddress>${p.street ? `<cbc:StreetName>${x(p.street)}</cbc:StreetName>` : ""}${p.postal ? `<cbc:PostalZone>${x(p.postal)}</cbc:PostalZone>` : ""}<cbc:CitySubdivisionName>${x(p.district || p.city)}</cbc:CitySubdivisionName><cbc:CityName>${x(p.city)}</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>${p.office ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${x(p.office)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` : ""}<cac:Contact>${p.phone ? `<cbc:Telephone>${x(p.phone)}</cbc:Telephone>` : ""}${p.email ? `<cbc:ElectronicMail>${x(p.email)}</cbc:ElectronicMail>` : ""}</cac:Contact>${p.first ? `<cac:Person><cbc:FirstName>${x(p.first)}</cbc:FirstName><cbc:FamilyName>${x(p.last)}</cbc:FamilyName></cac:Person>` : ""}</cac:Party>`;

  const supplier = party({ id: s.vkn, org: s.title, web: s.web, street: s.street, district: s.district, city: s.city, postal: s.postal, office: s.office, phone: s.phone, email: s.email });
  // Bireysel alıcı: TCKN verilmediyse GİB'in kabul ettiği 11111111111
  const customer = party({ id: b.tckn || "11111111111", street: b.address, city: b.city, phone: b.phone, email: b.email, first: b.name, last: b.surname });

  const taxSub = (net, tax, rate) => `<cac:TaxSubtotal><cbc:TaxableAmount ${cur}>${r2(net)}</cbc:TaxableAmount><cbc:TaxAmount ${cur}>${r2(tax)}</cbc:TaxAmount><cbc:Percent>${rate}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;
  const lines = rows.map(r => `<cac:InvoiceLine><cbc:ID>${r.i}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${r.q}</cbc:InvoicedQuantity><cbc:LineExtensionAmount ${cur}>${r2(r.net)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount ${cur}>${r2(r.tax)}</cbc:TaxAmount>${taxSub(r.net, r.tax, r.rate)}</cac:TaxTotal><cac:Item><cbc:Name>${x(r.name)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount ${cur}>${r.unit.toFixed(4)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join("");

  const series = (env.INVOICE_SERIES || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  // Kök eleman InvoiceInfo içindeki "Invoice" alanıdır (tempuri ad alanı); içerik UBL-TR ad alanlarında.
  return `<Invoice xmlns="http://tempuri.org/" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`
    + `<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>`
    + `<cbc:ID>${series}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${x(order.uuid)}</cbc:UUID>`
    + `<cbc:IssueDate>${issueDate}</cbc:IssueDate><cbc:IssueTime>${issueTime}</cbc:IssueTime><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>`
    + `<cbc:Note>Sipariş no: ${x(order.orderNo)}</cbc:Note><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${rows.length}</cbc:LineCountNumeric>`
    + `<cac:OrderReference><cbc:ID>${x(order.orderNo)}</cbc:ID><cbc:IssueDate>${issueDate}</cbc:IssueDate></cac:OrderReference>`
    + `<cac:AccountingSupplierParty>${supplier}</cac:AccountingSupplierParty><cac:AccountingCustomerParty>${customer}</cac:AccountingCustomerParty>`
    + `<cac:TaxTotal><cbc:TaxAmount ${cur}>${r2(totalTax)}</cbc:TaxAmount>${Object.entries(byRate).map(([rate, t]) => taxSub(t.net, t.tax, rate)).join("")}</cac:TaxTotal>`
    + `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount ${cur}>${r2(totalNet)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount ${cur}>${r2(totalNet)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount ${cur}>${r2(totalNet + totalTax)}</cbc:TaxInclusiveAmount><cbc:PayableAmount ${cur}>${r2(totalNet + totalTax)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`
    + lines + `</Invoice>`;
}

// Ödeme onaylandıktan sonra çağrılır: faturayı keser, { uuid, number, scenario } döner.
export async function sendInvoice(env, order) {
  const payDate = (order.paidAt || new Date()).toISOString();
  const carrier = env.SHIP_CARRIER_NAME ? `<ShipmentInfo><SendDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/><Carier SenderTcknVkn="${x(env.SHIP_CARRIER_VKN || "")}" SenderName="${x(env.SHIP_CARRIER_NAME)}"/></ShipmentInfo>` : "";
  const info = `<InvoiceInfo LocalDocumentId="${x(order.orderNo)}">${buildInvoiceXml(env, order)}`
    + `<EArchiveInvoiceInfo DeliveryType="Electronic"><InternetSalesInfo><WebAddress>${x(env.SELLER_WEB || "https://mddstudio.co")}</WebAddress><PaymentMidierName>${x(order.paymentMidier || "Vakıf Katılım")}</PaymentMidierName><PaymentType>${x(order.paymentType || "KREDIKARTI/BANKAKARTI")}</PaymentType><PaymentDate>${payDate}</PaymentDate>${carrier}</InternetSalesInfo></EArchiveInvoiceInfo>`
    + `<Scenario>Automated</Scenario><CreateDateUtc>${new Date().toISOString()}</CreateDateUtc></InvoiceInfo>`;
  const { inner } = await soap(env, "SendInvoice", `<SendInvoice xmlns="http://tempuri.org/"><invoices>${info}</invoices></SendInvoice>`);
  const v = inner.match(/<Value\b[^>]*?Id="([^"]*)"[^>]*?Number="([^"]*)"[^>]*?InvoiceScenario="([^"]*)"/) || inner.match(/Id="([^"]*)"[\s\S]*?Number="([^"]*)"[\s\S]*?InvoiceScenario="([^"]*)"/);
  if (!v) throw new Error("Uyumsoft SendInvoice: yanıt çözümlenemedi");
  return { uuid: v[1], number: v[2], scenario: v[3] };
}

// Faturanın PDF'i (base64). Fatura kuyruktan geçip imzalanana kadar kısa bir süre hazır olmayabilir.
export async function getInvoicePdf(env, uuid) {
  const { inner } = await soap(env, "GetOutboxInvoicePdf", `<GetOutboxInvoicePdf xmlns="http://tempuri.org/"><invoiceId>${x(uuid)}</invoiceId></GetOutboxInvoicePdf>`);
  const d = inner.match(/<Data>([\s\S]*?)<\/Data>/);
  return d ? d[1].replace(/\s+/g, "") : null;
}

export async function invoiceStatus(env, uuid) {
  const { inner } = await soap(env, "QueryOutboxInvoiceStatus", `<QueryOutboxInvoiceStatus xmlns="http://tempuri.org/"><invoiceIds><string>${x(uuid)}</string></invoiceIds></QueryOutboxInvoiceStatus>`);
  const st = inner.match(/Status="([^"]*)"/), code = inner.match(/StatusCode="([^"]*)"/), msg = inner.match(/Message="([^"]*)"/);
  return { status: st && st[1], code: code && Number(code[1]), message: msg && msg[1] };
}

// Alıcının görüntüleyebileceği fatura bağlantısı (dokümanda 4.3.2)
export const invoiceLink = uuid => `https://edonusum.uyum.com.tr/Genel/Fatura/${encodeURIComponent(uuid)}`;
