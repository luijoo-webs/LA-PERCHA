// =============================================================================
// LA PERCHA — Edge Function: enviar-correo-pedido
// Envía al cliente el correo "¡Gracias por tu compra!" cuando el admin registra el pago
// de un pedido online: productos con foto, totales y el comprobante en PDF adjunto.
// Si con ese pago el cliente completó sus compras del Club La Percha, envía además un
// correo aparte "¡Ganaste un bono!" con el código (una sola vez por bono: coupons.notificado_at).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GMAIL_USER          laperchavup@gmail.com
//   GMAIL_APP_PASSWORD  contraseña de aplicación de Google (16 letras)
// Supabase ya provee: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
//
// Seguridad: solo administradores (profiles.role = 'admin'). El destinatario sale
// del pedido en la base de datos, nunca del navegador.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const money = (n: unknown) => n == null ? "A confirmar" : "$ " + Math.round(Number(n)).toLocaleString("es-CO");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const SITE = "https://laperchavup.com/";
const LOGO = SITE + "assets/logo-header.png";
const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }) : "";
const FOOT_TXT = "La Percha · Cra. 19E2 #13B-46, frente a la cancha de Las Flores · Valledupar\nWhatsApp: https://wa.me/573144543114 · Instagram: @laperchavup";

// Correo dedicado al bono de cliente frecuente
function bonoMail(nombre: string, c: { codigo: string; valor: number; termina: string | null }, meta: number) {
  const subject = `🎁 ¡Ganaste un bono de ${money(c.valor)} en La Percha!`;
  const html = `<div style="background:#f2f1ee;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#0f0f0f">
<tr><td align="center" style="padding:30px 28px 10px"><img src="${LOGO}" width="130" alt="La Percha" style="display:block;width:130px;height:auto"></td></tr>
<tr><td align="center" style="padding:18px 34px 6px">
  <p style="margin:0 0 10px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a24e;font-weight:bold">Club La Percha</p>
  <h1 style="margin:0 0 14px;font-size:30px;line-height:1.12;text-transform:uppercase;color:#ffffff">¡${nombre ? esc(nombre) + ", g" : "G"}anaste ${money(c.valor)}!</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#cfc9bd">Completaste ${meta} compras con nosotros y te lo queremos agradecer: este bono es tuyo para lo que quieras de la tienda.</p>
</td></tr>
<tr><td align="center" style="padding:0 34px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:2px dashed #c9a24e;padding:22px 16px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#bdb8ad">Tu código</p>
    <p style="margin:0 0 6px;font-family:Consolas,Menlo,monospace;font-size:30px;letter-spacing:4px;color:#e2c477;font-weight:bold">${esc(c.codigo)}</p>
    <p style="margin:0;font-size:14px;color:#ffffff"><b>${money(c.valor)}</b> de descuento · un solo uso</p>
    ${c.termina ? `<p style="margin:6px 0 0;font-size:13px;color:#e2c477">Válido hasta el ${fecha(c.termina)}</p>` : ""}
  </td></tr></table>
</td></tr>
<tr><td style="padding:26px 34px 6px;color:#cfc9bd;font-size:14px;line-height:1.7">
  <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a24e;font-weight:bold">Cómo usarlo</p>
  1. Inicia sesión en la tienda con esta misma cuenta.<br>
  2. Agrega lo que te guste al carrito.<br>
  3. En el último paso escribe el código en <b style="color:#fff">"Cupón de descuento"</b> (o tócalo en "Tus cupones disponibles") y pulsa Aplicar.
</td></tr>
<tr><td align="center" style="padding:24px 34px 34px">
  <a href="${SITE}#/tienda" style="display:inline-block;background:#c9a24e;color:#111;padding:15px 30px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-decoration:none">Usar mi bono</a>
  <p style="margin:14px 0 0;font-size:12px;color:#8f897d">También lo encuentras en <a href="${SITE}#/cuenta" style="color:#c9a24e">Mi cuenta</a>. Es personal: solo funciona con tu cuenta.</p>
</td></tr>
<tr><td align="center" style="background:#000;padding:20px 26px;font-size:12px;line-height:1.7;color:#8f897d">
  ¿Dudas? Escríbenos por <a href="https://wa.me/573144543114" style="color:#fff">WhatsApp</a><br>
  Cra. 19E2 #13B-46, frente a la cancha de Las Flores · Valledupar · <a href="https://www.instagram.com/laperchavup/" style="color:#c9a24e;text-decoration:none">@laperchavup</a></td></tr>
</table></div>`;
  const text = `¡${nombre ? nombre + ", g" : "G"}anaste un bono de ${money(c.valor)} en La Percha!

Completaste ${meta} compras con nosotros. Este bono es tuyo para cualquier producto de la tienda.

TU CÓDIGO: ${c.codigo}
Valor: ${money(c.valor)} · un solo uso · personal (solo funciona con tu cuenta)${c.termina ? "\nVálido hasta el " + fecha(c.termina) : ""}

Cómo usarlo:
1. Inicia sesión en la tienda con esta misma cuenta: ${SITE}#/cuenta
2. Agrega lo que te guste al carrito.
3. En el último paso escribe el código en "Cupón de descuento" y pulsa Aplicar.

${FOOT_TXT}`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
    if (!user) return json(401, { error: "NO_AUTENTICADO" });
    const { data: prof } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") return json(403, { error: "NO_AUTORIZADO" });

    const gUser = Deno.env.get("GMAIL_USER"), gPass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!gUser || !gPass) return json(501, { error: "EMAIL_NO_CONFIGURADO" });

    const { order_id, pdf_base64 } = await req.json();
    if (!order_id) return json(400, { error: "DATOS_INCOMPLETOS" });
    if (pdf_base64 && pdf_base64.length > 8_000_000) return json(413, { error: "PDF_DEMASIADO_GRANDE" });

    const { data: o } = await db.from("orders").select("*, order_items(*)").eq("id", order_id).maybeSingle();
    if (!o) return json(404, { error: "PEDIDO_NO_EXISTE" });
    let to = String(o.cliente?.email || "").trim();
    if (!to && o.user_id) { const { data: p } = await db.from("profiles").select("email").eq("id", o.user_id).maybeSingle(); to = String(p?.email || "").trim(); }
    if (!to) return json(400, { error: "CLIENTE_SIN_CORREO" });

    const foto = (src: string) => !src ? "" : /^https?:/.test(src) ? src
      : /^img\/catalogo\//.test(src) ? `${url}/storage/v1/object/public/productos/${src.slice(4)}` : SITE + src;
    const nombre = String(o.cliente?.nombre || "").trim().split(/\s+/)[0];
    const items = (o.order_items || []).sort((a: any, b: any) => a.id - b.id);
    const rows = items.map((i: any) => `
      <tr><td style="padding:14px 0;border-bottom:1px solid #eee;width:96px;vertical-align:top">
          ${i.imagen ? `<img src="${esc(foto(i.imagen))}" width="84" alt="" style="display:block;width:84px;height:105px;object-fit:cover;background:#eee">` : ""}</td>
        <td style="padding:14px 12px;border-bottom:1px solid #eee;vertical-align:top;font-size:14px;line-height:1.5">
          <b style="text-transform:uppercase">${esc(i.nombre)}</b><br>
          <span style="color:#777;font-size:13px">Talla ${esc(i.talla)}${i.color ? " · " + esc(i.color) : ""} · Cantidad ${i.cantidad}</span></td>
        <td style="padding:14px 0;border-bottom:1px solid #eee;vertical-align:top;text-align:right;font-size:14px;white-space:nowrap">${money(i.subtotal)}</td></tr>`).join("");
    // Club La Percha: bono disponible, progreso o invitación a crear cuenta
    const { data: fid } = await db.from("store_settings").select("value").eq("key", "fidelidad").maybeSingle();
    const cfg = { activo: fid?.value?.activo !== false, meta: Number(fid?.value?.compras) || 5, valor: Number(fid?.value?.valor) || 20000 };
    let club = "";
    if (cfg.activo) {
      const box = (inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px"><tr><td style="background:#0f0f0f;border-top:3px solid #c9a24e;padding:20px 22px;color:#f3efe6;font-size:14px;line-height:1.6">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a24e;font-weight:bold">Club La Percha</p>${inner}</td></tr></table>`;
      if (o.user_id) {
        const { count: cPedidos } = await db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", o.user_id).in("estado", ["pagado", "preparando", "enviado", "entregado"]);
        const { count: cVentas } = await db.from("sales").select("id", { count: "exact", head: true }).eq("user_id", o.user_id).eq("estado", "completada");
        const count = (cPedidos || 0) + (cVentas || 0);
        const { data: cps } = await db.from("coupons").select("codigo, valor, usos, max_usos, termina").eq("user_id", o.user_id).eq("activo", true).order("created_at", { ascending: false });
        const libres = (cps || []).filter((c: any) => c.usos < (c.max_usos ?? 1) && (!c.termina || new Date(c.termina) > new Date()));
        const prog = (count || 0) % cfg.meta;
        if (libres.length) club = box(`<p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#fff;text-transform:uppercase">¡Tienes un bono de ${money(libres[0].valor)}!</p>
          <p style="margin:0 0 14px;color:#cfc9bd">Gracias por ser cliente frecuente. Escríbelo en "Cupón de descuento" en tu próxima compra (con tu sesión iniciada). Sirve una sola vez.</p>
          ${libres.map((c: any) => `<p style="margin:0 0 8px;border:1px dashed #c9a24e;padding:10px 14px;font-family:Consolas,Menlo,monospace;font-size:20px;letter-spacing:3px;color:#d9b866;text-align:center">${esc(c.codigo)}${c.termina ? `<br><span style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:0;color:#cfc9bd">Válido hasta el ${fecha(c.termina)}</span>` : ""}</p>`).join("")}`);
        else club = box(`<p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#fff">Llevas ${prog} de ${cfg.meta} compras</p>
          <p style="margin:0;color:#cfc9bd">Al completar ${cfg.meta} compras te regalamos un bono de <b style="color:#fff">${money(cfg.valor)}</b> para cualquier producto de la tienda.</p>`);
      } else {
        club = box(`<p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#fff">Gana un bono de ${money(cfg.valor)}</p>
          <p style="margin:0 0 14px;color:#cfc9bd">Crea tu cuenta gratis con este mismo correo: esta compra quedará en tu historial y cada ${cfg.meta} compras te regalamos ${money(cfg.valor)}.</p>
          <a href="${SITE}#/cuenta/registro" style="display:inline-block;background:#c9a24e;color:#111;padding:12px 22px;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-decoration:none">Crear mi cuenta</a>`);
      }
    }

    const html = `<div style="background:#f2f1ee;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#fff">
<tr><td align="center" style="background:#0f0f0f;padding:28px"><img src="${LOGO}" width="140" alt="La Percha" style="display:block;width:140px;height:auto"></td></tr>
<tr><td style="height:3px;background:#c9a24e;font-size:0;line-height:3px">&nbsp;</td></tr>
<tr><td style="padding:36px 34px 8px">
  <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a8832f;font-weight:bold">Pedido ${esc(o.numero)} · Pago confirmado</p>
  <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;text-transform:uppercase">¡Gracias por tu compra${nombre ? ", " + esc(nombre) : ""}!</h1>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#333">Recibimos tu pago y ya estamos preparando tu pedido. Gracias por confiar en <b>La Percha</b>: cada prenda la escogemos para que salgas con estilo.</p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#333">Te avisaremos por WhatsApp cuando tu pedido salga. Adjuntamos tu comprobante en PDF.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee">${rows}</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;font-size:14px">
    <tr><td style="padding:3px 0;color:#666">Subtotal</td><td style="padding:3px 0;text-align:right">${money(o.subtotal)}</td></tr>
    ${Number(o.descuento) > 0 ? `<tr><td style="padding:3px 0;color:#666">${o.cupon_codigo ? "Bono " + esc(o.cupon_codigo) : "Descuento"}</td><td style="padding:3px 0;text-align:right">-${money(o.descuento)}</td></tr>` : ""}
    <tr><td style="padding:3px 0;color:#666">Envío</td><td style="padding:3px 0;text-align:right">${o.envio == null ? "Coordinado por WhatsApp" : money(o.envio)}</td></tr>
    <tr><td style="padding:10px 0 0;font-size:17px;font-weight:bold;border-top:1px solid #111">Total</td><td style="padding:10px 0 0;text-align:right;font-size:17px;font-weight:bold;border-top:1px solid #111">${money(o.total)}</td></tr>
  </table>
  <p style="margin:22px 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:bold">Entrega</p>
  <p style="margin:0 0 26px;font-size:14px;line-height:1.6;color:#333">${esc(o.cliente?.nombre)}<br>${esc(o.cliente?.direccion)}${o.cliente?.barrio ? ", " + esc(o.cliente.barrio) : ""}<br>${esc(o.cliente?.ciudad)}</p>
  ${club}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 30px"><tr><td style="background:#111"><a href="${SITE}#/tienda" style="display:inline-block;padding:15px 30px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:#fff;text-decoration:none">Seguir comprando</a></td></tr></table>
</td></tr>
<tr><td align="center" style="background:#0f0f0f;padding:22px 26px;font-size:12px;line-height:1.7;color:#bdb8ad">
  ¿Dudas con tu pedido? Escríbenos por <a href="https://wa.me/573144543114" style="color:#fff">WhatsApp</a><br>
  Cra. 19E2 #13B-46, frente a la cancha de Las Flores · Valledupar<br>
  <a href="https://www.instagram.com/laperchavup/" style="color:#c9a24e;text-decoration:none">@laperchavup</a></td></tr>
</table></div>`;

    const text = [`¡Gracias por tu compra${nombre ? ", " + nombre : ""}!`, "",
      `Pedido ${o.numero} · Pago confirmado. Ya estamos preparando tu pedido y te avisaremos por WhatsApp cuando salga.`, "",
      ...items.map((i: any) => `- ${i.nombre} · Talla ${i.talla}${i.color ? " · " + i.color : ""} · x${i.cantidad} · ${money(i.subtotal)}`), "",
      `Subtotal: ${money(o.subtotal)}`, ...(Number(o.descuento) > 0 ? [`${o.cupon_codigo ? "Bono " + o.cupon_codigo : "Descuento"}: -${money(o.descuento)}`] : []),
      `Envío: ${o.envio == null ? "Coordinado por WhatsApp" : money(o.envio)}`, `Total: ${money(o.total)}`, "",
      "Adjuntamos tu comprobante en PDF.", `Seguir comprando: ${SITE}#/tienda`, "", FOOT_TXT].join("\n");
    const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gUser, pass: gPass.replace(/\s+/g, "") } });
    await t.sendMail({
      from: `"La Percha" <${gUser}>`, to, replyTo: gUser, subject: `¡Gracias por tu compra! — Pedido ${o.numero} · La Percha`, html, text,
      attachments: pdf_base64 ? [{ filename: `${o.numero}.pdf`, content: pdf_base64, encoding: "base64", contentType: "application/pdf" }] : [],
    });
    await db.from("orders").update({ email_gracias_at: new Date().toISOString() }).eq("id", o.id);

    // Bono recién ganado: correo aparte, una sola vez por bono
    let bono: string | null = null;
    if (cfg.activo && o.user_id) {
      const { data: nuevos } = await db.from("coupons").select("id, codigo, valor, usos, max_usos, termina")
        .eq("user_id", o.user_id).eq("activo", true).eq("condiciones->>programa", "fidelidad").is("notificado_at", null).order("created_at");
      const { data: prof2 } = await db.from("profiles").select("email, nombre").eq("id", o.user_id).maybeSingle();
      const toBono = String(prof2?.email || to).trim();
      const nom = String(prof2?.nombre || o.cliente?.nombre || "").trim().split(/\s+/)[0];
      for (const c of (nuevos || []).filter((c: any) => c.usos < (c.max_usos ?? 1))) {
        const m = bonoMail(nom, { codigo: c.codigo, valor: Number(c.valor), termina: c.termina }, cfg.meta);
        try {
          await t.sendMail({ from: `"La Percha" <${gUser}>`, to: toBono, replyTo: gUser, subject: m.subject, html: m.html, text: m.text });
          await db.from("coupons").update({ notificado_at: new Date().toISOString() }).eq("id", c.id);
          bono = c.codigo;
        } catch (_) { /* el bono sigue visible en Mi cuenta; se reintenta en el próximo envío */ }
      }
    }
    return json(200, { ok: true, to, bono });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) });
  }
});
