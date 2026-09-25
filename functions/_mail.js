// Ortak e-posta gönderimi (Cloudflare Email Service).
// Önce EMAIL (send_email) bağlantısı, yoksa CF_EMAIL_TOKEN ile REST API kullanılır.
// DEV_MAIL_LOG tanımlıysa (yalnızca yerel test) mail gönderilmez, konsola yazılır.
export async function sendMail(env, { to, subject, text, html, from }) {
  const msg = { to, from: from || env.MAIL_FROM || "info@mddstudio.co", subject, text, html };
  if (env.DEV_MAIL_LOG) {
    console.log("DEV_MAIL", JSON.stringify({ to, subject, text }));
    return true;
  }
  if (env.EMAIL && typeof env.EMAIL.send === "function") {
    await env.EMAIL.send(msg);
    return true;
  }
  if (!env.CF_EMAIL_TOKEN) return false;
  const account = env.CF_ACCOUNT_ID || "07a66e46f94888850bd39f0f732d9556";
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.CF_EMAIL_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!r.ok) console.log("mail send failed", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

// Müşteriye giden mailler için ortak, sade MDD Studio şablonu
export function brandedHtml(title, bodyHtml) {
  return `<div style="background:#FDE7EF;padding:24px 12px;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#FFFCF7;border-radius:18px;padding:28px 24px;color:#1F2A56">
<div style="font:bold 20px Georgia,serif;margin-bottom:14px">MDD <span style="font:16px Arial,sans-serif">Studio</span></div>
<h2 style="margin:0 0 12px;font-size:19px">${title}</h2>
${bodyHtml}
<p style="margin:22px 0 0;color:#6B6F8E;font-size:12px">Bu e-postayı siz talep etmediyseniz dikkate almayın. · MDD Studio · info@mddstudio.co</p>
</div></div>`;
}

export function button(href, label) {
  return `<p style="margin:18px 0"><a href="${href}" style="background:#1F2A56;color:#FFFCF7;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${label}</a></p>
<p style="font-size:12px;color:#6B6F8E;word-break:break-all">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br>${href}</p>`;
}
