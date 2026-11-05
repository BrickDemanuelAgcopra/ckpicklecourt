// Branded HTML for guest booking emails. Email clients ignore <style> blocks and modern CSS
// unevenly, so everything is table layout with inline styles, 600px max, system fonts.

export type Tone = "green" | "gold" | "red" | "grey";

export type EmailRow = { label: string; value: string; strong?: boolean; tone?: Tone };

export type BookingEmailView = {
  preheader: string; // inbox preview text
  badge: string; // e.g. "Confirmed"
  tone: Tone;
  heading: string;
  greeting: string;
  intro: string[]; // paragraphs
  reference: string;
  schedule: { court: string; date: string; time: string }[];
  equipment: { name: string; detail: string; amount: string }[];
  charges: EmailRow[]; // line items ending with total
  settlement: EmailRow[]; // paid / balance rows
  receipt?: { title: string; rows: EmailRow[] }; // "Official receipt" style block for a payment
  payments: { date: string; method: string; reference: string; amount: string }[];
  location?: { text: string; mapsUrl: string };
  cta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
  scheduleTitle?: string; // defaults to "Your court time(s)"
  footerNote?: string; // replaces the default "You're receiving this because…" line
  courtName: string;
  tagline: string;
  logoUrl: string;
  siteUrl: string;
  contact: { phone: string; email: string; facebook: string };
};

const C = {
  bg: "#f7f3ea",
  surface: "#ffffff",
  green: "#123a1f",
  greenDeep: "#0b2413",
  greenMid: "#1f5a30",
  greenSoft: "#e3ede4",
  gold: "#c9a35a",
  goldBg: "#f6eedb",
  goldText: "#8a6a21",
  ink: "#14381e",
  inkSoft: "#3d4a3f",
  inkFaint: "#7f8a80",
  line: "#e4e0d4",
  red: "#a73522",
  redBg: "#fbe9e6",
  greyBg: "#eeefec",
  grey: "#5f665f",
};

const TONE: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: C.greenMid, bg: C.greenSoft },
  gold: { fg: C.goldText, bg: C.goldBg },
  red: { fg: C.red, bg: C.redBg },
  grey: { fg: C.grey, bg: C.greyBg },
};

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sectionTitle(t: string): string {
  return `<tr><td style="padding:28px 0 10px;font:700 11px/1 ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${C.goldText};">${esc(t)}</td></tr>`;
}

function rowsTable(rows: EmailRow[]): string {
  return rows
    .map((r) => {
      const color = r.tone ? TONE[r.tone].fg : r.strong ? C.ink : C.inkSoft;
      const weight = r.strong ? 700 : 400;
      const size = r.strong ? 16 : 14;
      const border = r.strong ? `border-top:1px solid ${C.line};` : "";
      const pad = r.strong ? "12px 0 4px" : "6px 0";
      return `<tr>
  <td style="${border}padding:${pad};font:${weight} ${size}px/1.4 ${FONT};color:${color};">${esc(r.label)}</td>
  <td align="right" style="${border}padding:${pad};font:${weight} ${size}px/1.4 ${FONT};color:${color};white-space:nowrap;">${esc(r.value)}</td>
</tr>`;
    })
    .join("");
}

function button(label: string, url: string, variant: "solid" | "outline" = "solid"): string {
  const solid = variant === "solid";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
  <td align="center" bgcolor="${solid ? C.green : C.surface}" style="border-radius:999px;${solid ? "" : `border:1.5px solid ${C.green};`}">
    <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font:700 15px/1 ${FONT};color:${solid ? "#ffffff" : C.green};text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

export function renderBookingEmailHtml(v: BookingEmailView): string {
  const tone = TONE[v.tone];

  const schedule = v.schedule
    .map(
      (s) => `<tr><td style="padding:0 0 10px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-radius:12px;border-left:4px solid ${C.gold};">
    <tr><td style="padding:14px 16px;">
      <div style="font:700 15px/1.3 ${FONT};color:${C.ink};">${esc(s.court)}</div>
      <div style="font:400 14px/1.5 ${FONT};color:${C.inkSoft};padding-top:2px;">${esc(s.date)}</div>
      <div style="font:600 14px/1.5 ${FONT};color:${C.greenMid};">${esc(s.time)}</div>
    </td></tr>
  </table>
</td></tr>`
    )
    .join("");

  const equipment = v.equipment.length
    ? sectionTitle("Equipment rental") +
      `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${v.equipment
        .map(
          (e) => `<tr>
  <td style="padding:6px 0;font:400 14px/1.4 ${FONT};color:${C.inkSoft};">${esc(e.name)} <span style="color:${C.inkFaint};">· ${esc(e.detail)}</span></td>
  <td align="right" style="padding:6px 0;font:400 14px/1.4 ${FONT};color:${C.inkSoft};white-space:nowrap;">${esc(e.amount)}</td>
</tr>`
        )
        .join("")}</table></td></tr>`
    : "";

  const receipt = v.receipt
    ? `<tr><td style="padding:24px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1.5px dashed ${C.gold};border-radius:14px;background:#fffdf7;">
    <tr><td style="padding:18px 20px 14px;">
      <div style="font:700 11px/1 ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${C.goldText};padding-bottom:10px;">${esc(v.receipt.title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsTable(v.receipt.rows)}</table>
    </td></tr>
  </table>
</td></tr>`
    : "";

  const payments = v.payments.length
    ? sectionTitle("Payments received") +
      `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${v.payments
        .map(
          (p) => `<tr>
  <td style="padding:6px 0;border-bottom:1px solid ${C.line};font:400 13px/1.45 ${FONT};color:${C.inkSoft};">
    ${esc(p.date)}<br><span style="color:${C.inkFaint};">${esc(p.method)}${p.reference ? ` · Ref ${esc(p.reference)}` : ""}</span>
  </td>
  <td align="right" valign="top" style="padding:6px 0;border-bottom:1px solid ${C.line};font:600 14px/1.45 ${FONT};color:${C.ink};white-space:nowrap;">${esc(p.amount)}</td>
</tr>`
        )
        .join("")}</table></td></tr>`
    : "";

  const location = v.location
    ? sectionTitle("Where to find us") +
      `<tr><td style="font:400 14px/1.55 ${FONT};color:${C.inkSoft};">${esc(v.location.text)}${
        v.location.mapsUrl
          ? `<div style="padding-top:12px;">${button("Open in Maps", v.location.mapsUrl, "outline").replace("margin:0 auto;", "margin:0;")}</div>`
          : ""
      }</td></tr>`
    : "";

  const contactBits = [
    v.contact.phone && esc(v.contact.phone),
    v.contact.email && `<a href="mailto:${esc(v.contact.email)}" style="color:${C.gold};text-decoration:none;">${esc(v.contact.email)}</a>`,
    v.contact.facebook &&
      `<a href="${esc(/^https?:/i.test(v.contact.facebook) ? v.contact.facebook : `https://${v.contact.facebook}`)}" style="color:${C.gold};text-decoration:none;">Facebook</a>`,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(v.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${esc(v.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

  <!-- header -->
  <tr><td align="center" bgcolor="${C.green}" style="background:${C.green};border-radius:18px 18px 0 0;padding:28px 24px 22px;">
    <a href="${esc(v.siteUrl)}" target="_blank" style="text-decoration:none;">
      <img src="${esc(v.logoUrl)}" width="84" height="84" alt="${esc(v.courtName)}" style="display:block;margin:0 auto;border:0;width:84px;height:84px;">
    </a>
    <div style="padding-top:12px;font:700 13px/1.2 ${FONT};letter-spacing:3px;text-transform:uppercase;color:${C.gold};">${esc(v.courtName)}</div>
    ${v.tagline ? `<div style="padding-top:4px;font:400 12px/1.4 ${FONT};color:#b9c8bc;">${esc(v.tagline)}</div>` : ""}
  </td></tr>
  <tr><td height="4" bgcolor="${C.gold}" style="background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- body -->
  <tr><td bgcolor="${C.surface}" style="background:${C.surface};padding:32px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${tone.bg};font:700 11px/1 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${tone.fg};">${esc(v.badge)}</span>
      </td></tr>
      <tr><td align="center" style="padding:16px 0 8px;font:800 26px/1.25 ${FONT};color:${C.ink};">${esc(v.heading)}</td></tr>
      <tr><td style="padding:12px 0 0;font:400 15px/1.6 ${FONT};color:${C.inkSoft};">${esc(v.greeting)}</td></tr>
      ${v.intro.map((p) => `<tr><td style="padding:10px 0 0;font:400 15px/1.6 ${FONT};color:${C.inkSoft};">${esc(p)}</td></tr>`).join("")}

      <!-- reference -->
      <tr><td style="padding:24px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.goldBg}" style="background:${C.goldBg};border-radius:14px;">
          <tr><td align="center" style="padding:16px;">
            <div style="font:700 11px/1 ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${C.goldText};">Booking reference</div>
            <div style="padding-top:8px;font:800 24px/1 'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;letter-spacing:2px;color:${C.ink};">${esc(v.reference)}</div>
          </td></tr>
        </table>
      </td></tr>

      ${receipt}

      ${sectionTitle(v.scheduleTitle ?? (v.schedule.length > 1 ? "Your court times" : "Your court time"))}
      ${schedule}

      ${equipment}

      ${sectionTitle("Summary")}
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsTable(v.charges)}${rowsTable(v.settlement)}</table></td></tr>

      ${payments}
      ${location}

      ${v.cta ? `<tr><td style="padding:32px 0 8px;">${button(v.cta.label, v.cta.url)}</td></tr>` : ""}
      ${v.secondaryCta ? `<tr><td style="padding:4px 0 8px;">${button(v.secondaryCta.label, v.secondaryCta.url, "outline")}</td></tr>` : ""}
    </table>
  </td></tr>

  <!-- footer -->
  <tr><td bgcolor="${C.surface}" style="background:${C.surface};border-radius:0 0 18px 18px;padding:${contactBits.length ? "16px 32px 28px" : "0 32px 24px"};">
    ${contactBits.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-top:1px solid ${C.line};padding-top:18px;font:400 13px/1.6 ${FONT};color:${C.inkFaint};" align="center">
        Questions? Message us<br>${contactBits.join(" &nbsp;·&nbsp; ")}
      </td></tr>
    </table>` : ""}
  </td></tr>
  <tr><td align="center" style="padding:18px 24px 0;font:400 12px/1.6 ${FONT};color:${C.inkFaint};">
    ${esc(v.footerNote ?? `You're receiving this because you booked a court at ${v.courtName}.`)}<br>
    <a href="${esc(v.siteUrl)}" style="color:${C.inkFaint};">${esc(v.siteUrl.replace(/^https?:\/\//, ""))}</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
