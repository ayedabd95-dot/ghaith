import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Org, Profile } from '../lib/supabase';
import { logoUrl, assetUrl } from '../lib/logo';
import { ROLE_LABEL, ROLE_LABEL_EN, dmy } from '../lib/format';

/**
 * ISO/IEC 7810 ID-1 portrait card, drawn at 340×540 px (≈6.3 px/mm) and printed at 54×85.6 mm.
 * Front is Arabic, back is English. Security layers: guilloche ground, microtext, ghost photo,
 * hologram patch, and a QR that checks the card live against the organization's records.
 */
export const CARD_W = 340;
export const CARD_H = 540;

const G = { dark: '#0b3a23', mid: '#145f39', light: '#e8f3ec', gold: '#c99a1e', goldLight: '#f3e3b5', ink: '#17211c', soft: '#5d6b63' };

export function verifyUrl(token: string) { return `${location.origin}${import.meta.env.BASE_URL}verify/${token}`; }
export function accountUrl() { return `${location.origin}${import.meta.env.BASE_URL}my-card`; }

function useQr(text: string, size = 300) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { margin: 0, width: size, errorCorrectionLevel: 'M', color: { dark: G.dark, light: '#ffffff' } }).then(setSrc); }, [text, size]);
  return src;
}
function useBarcode(text: string | null) {
  return useMemo(() => {
    if (!text) return '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, text, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6, lineColor: G.ink, background: 'transparent' });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }, [text]);
}

/** Fine wavy security lines, same for every card of an org (seeded by its id). */
function Guilloche({ seed, opacity = 0.16 }: { seed: string; opacity?: number }) {
  const paths = useMemo(() => {
    let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const out: string[] = [];
    for (let i = 0; i < 26; i++) {
      const amp = 8 + ((h >> (i % 16)) & 7) + i * 0.35, freq = 0.018 + ((h >> (i % 11)) & 3) * 0.004, y0 = 18 + i * 20, ph = i * 0.6;
      let d = `M0 ${y0}`;
      for (let x = 4; x <= CARD_W; x += 4) d += ` L${x} ${(y0 + amp * Math.sin(x * freq + ph) + (amp / 2.5) * Math.sin(x * freq * 2.7 + ph * 1.3)).toFixed(1)}`;
      out.push(d);
    }
    return out;
  }, [seed]);
  return (
    <svg className="absolute inset-0 pointer-events-none" width={CARD_W} height={CARD_H} aria-hidden>
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 3 === 0 ? G.gold : G.mid} strokeWidth="0.45" opacity={opacity} />)}
    </svg>
  );
}

function Microtext({ text, y }: { text: string; y: number }) {
  return (
    <div className="absolute inset-x-0 overflow-hidden whitespace-nowrap pointer-events-none" style={{ top: y, fontSize: 3.6, lineHeight: '4px', letterSpacing: 0.3, color: G.mid, opacity: 0.75, direction: 'ltr' }} aria-hidden>
      {Array.from({ length: 30 }, () => text).join(' • ')}
    </div>
  );
}

function Hologram({ label }: { label: string }) {
  return (
    <div className="rounded-full grid place-items-center font-bold" aria-hidden style={{
      width: 44, height: 44, fontSize: 9, letterSpacing: 0.5, color: 'rgba(40,40,60,.55)',
      background: 'conic-gradient(from 30deg, #f9d1e8, #c9e7ff, #d6ffd9, #fff3b8, #f6c8ff, #bfe9ff, #f9d1e8)',
      boxShadow: 'inset 0 0 6px rgba(255,255,255,.9), 0 0 0 1px rgba(201,154,30,.5)',
    }}>
      <div className="rounded-full grid place-items-center" style={{ width: 34, height: 34, border: '0.6px dashed rgba(60,60,90,.35)' }}>{label}</div>
    </div>
  );
}

/** Uploaded stamp, or a generated round seal with the org's names around the rim. */
export function Stamp({ org, size = 84 }: { org: Org; size?: number }) {
  const url = assetUrl('ch-logos', org.stamp_path);
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', transform: 'rotate(-10deg)', opacity: 0.9 }} />;
  const ink = '#1d3c8c', r = 50;
  const top = org.name, bottom = (org.name_en || 'OFFICIAL SEAL').toUpperCase();
  const topSize = Math.min(11, 125 / Math.max(top.length, 1) * 1.55);
  const botSize = Math.min(7.6, 112 / Math.max(bottom.length, 1) * 1.45);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ transform: 'rotate(-12deg)', opacity: 0.85 }} aria-hidden>
      <defs>
        <path id={`st-top-${org.id}`} d={`M ${60 - r + 8} 60 A ${r - 8} ${r - 8} 0 0 1 ${60 + r - 8} 60`} />
        <path id={`st-bot-${org.id}`} d={`M ${60 - r + 14} 62 A ${r - 14} ${r - 14} 0 0 0 ${60 + r - 14} 62`} />
      </defs>
      <circle cx="60" cy="60" r={r + 6} fill="none" stroke={ink} strokeWidth="2.6" />
      <circle cx="60" cy="60" r={r - 1} fill="none" stroke={ink} strokeWidth="1" />
      <circle cx="60" cy="60" r={r - 22} fill="none" stroke={ink} strokeWidth="1" />
      <text fill={ink} fontSize={topSize} fontWeight="700" fontFamily="IBM Plex Sans Arabic"><textPath href={`#st-top-${org.id}`} startOffset="50%" textAnchor="middle">{top}</textPath></text>
      <text fill={ink} fontSize={botSize} fontWeight="700" letterSpacing="0.3" fontFamily="IBM Plex Sans Arabic"><textPath href={`#st-bot-${org.id}`} startOffset="50%" textAnchor="middle">{bottom}</textPath></text>
      <text x="60" y="58" textAnchor="middle" fill={ink} fontSize="15">★</text>
      <text x="60" y="72" textAnchor="middle" fill={ink} fontSize="7" fontWeight="700" letterSpacing="0.6">{org.card_prefix}</text>
    </svg>
  );
}

function Signature({ org, en }: { org: Org; en?: boolean }) {
  const sig = assetUrl('ch-logos', org.signature_path);
  const name = en ? org.director_name_en || org.director_name : org.director_name;
  const title = en ? org.director_title_en || 'Director' : org.director_title || 'مدير المؤسسة';
  return (
    <div className="text-center" style={{ width: 136 }}>
      <div className="grid place-items-end justify-center" style={{ height: 34 }}>
        {sig ? <img src={sig} alt="" style={{ maxHeight: 34, maxWidth: 120, objectFit: 'contain' }} /> : <div style={{ width: 100, borderBottom: `1px solid ${G.soft}` }} />}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: G.ink, lineHeight: '13px', direction: en ? 'ltr' : 'rtl' }}>{name || '—'}</div>
      <div style={{ fontSize: 8, color: G.soft, lineHeight: '11px', direction: en ? 'ltr' : 'rtl' }}>{title}</div>
    </div>
  );
}

function Shell({ children, org }: { children: React.ReactNode; org: Org }) {
  return (
    <div className="id-card relative overflow-hidden bg-white select-none" style={{ width: CARD_W, height: CARD_H, borderRadius: 18, boxShadow: '0 12px 32px rgba(11,58,35,.18), 0 0 0 1px rgba(11,58,35,.08)', fontFamily: '"IBM Plex Sans Arabic", sans-serif', color: G.ink }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 60% at 100% 0%, ${G.light} 0%, #fff 55%), #fff` }} />
      <Guilloche seed={org.id} />
      {/* lanyard slot */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 10, width: 54, height: 8, background: '#fff', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.25)', zIndex: 5 }} />
      {children}
      {/* bottom wave */}
      <svg className="absolute bottom-0 left-0" width={CARD_W} height="34" viewBox={`0 0 ${CARD_W} 34`} aria-hidden>
        <path d={`M0 14 C 90 0, 200 30, ${CARD_W} 8 L ${CARD_W} 34 L 0 34 Z`} fill={G.dark} />
        <path d={`M0 12 C 90 -2, 200 28, ${CARD_W} 6`} fill="none" stroke={G.gold} strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function Header({ org, en }: { org: Org; en?: boolean }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: 92 }}>
      <svg className="absolute top-0 left-0" width={CARD_W} height="92" viewBox={`0 0 ${CARD_W} 92`} aria-hidden>
        <path d={`M0 0 H${CARD_W} V62 C 250 86, 110 50, 0 78 Z`} fill={G.dark} />
        <path d={`M0 78 C 110 50, 250 86, ${CARD_W} 62`} fill="none" stroke={G.gold} strokeWidth="1.8" />
      </svg>
      <div className="absolute flex items-center gap-2.5" style={{ top: 24, insetInline: 18, direction: en ? 'ltr' : 'rtl' }}>
        <img src={logoUrl(org.logo_path)} alt="" style={{ width: 42, height: 42, borderRadius: 10, background: '#fff', objectFit: 'contain', padding: 2, boxShadow: `0 0 0 1.5px ${G.gold}` }} />
        <div className="min-w-0" style={{ color: '#fff' }}>
          <div style={{ fontSize: en ? 13.5 : 15, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>{en ? org.name_en || org.name : org.name}</div>
          <div style={{ fontSize: 9, opacity: 0.85, lineHeight: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250, direction: en ? 'rtl' : 'ltr' }}>{en ? org.name : org.name_en || org.tagline || ''}</div>
        </div>
      </div>
    </div>
  );
}

export function CardFront({ p, org }: { p: Profile; org: Org }) {
  const photo = assetUrl('ch-ids', p.photo_path);
  const account = useQr(accountUrl(), 240);
  const bar = useBarcode(p.id_number);
  const rows: [string, string, boolean?][] = [
    ['الصفة', p.position || ROLE_LABEL[p.role]],
    ['المواليد', dmy(p.birth_date)],
    ...(p.blood_type ? [['فصيلة الدم', p.blood_type] as [string, string]] : []),
    ['تاريخ الإصدار', dmy(p.card_issued)],
    ['تاريخ النفاذ', dmy(p.card_expires), true],
  ];
  return (
    <Shell org={org}>
      <Header org={org} />
      {/* ribbon */}
      <div className="absolute flex items-center justify-center gap-2" style={{ top: 94, insetInline: 70, height: 24, borderRadius: 12, background: `linear-gradient(90deg, ${G.gold}, #e2bd55, ${G.gold})`, color: G.dark, fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>
        {p.role === 'volunteer' ? 'بطاقة متطوع' : 'بطاقة تعريف'} <span style={{ opacity: 0.6 }}>|</span> <span style={{ direction: 'ltr' }}>{p.role === 'volunteer' ? 'VOLUNTEER' : 'STAFF ID'}</span>
      </div>

      {/* photo + side */}
      <div className="absolute flex gap-3" style={{ top: 128, insetInline: 18, direction: 'rtl' }}>
        <div style={{ width: 112, height: 142, borderRadius: 12, padding: 3, background: `linear-gradient(135deg, ${G.gold}, #f4dc94, ${G.gold})` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 9, overflow: 'hidden', background: G.light }}>
            {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div className="w-full h-full grid place-items-center" style={{ fontSize: 46, fontWeight: 700, color: G.mid }}>{p.full_name.charAt(0)}</div>}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-between" style={{ paddingTop: 4, paddingBottom: 2 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: '23px', color: G.dark }}>{p.full_name}</div>
            <div style={{ fontSize: 10, color: G.soft, direction: 'ltr', textAlign: 'right', lineHeight: '14px' }}>{p.full_name_en || ''}</div>
            <div className="inline-block mt-1.5" style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: G.mid, borderRadius: 6, padding: '1px 8px' }}>{ROLE_LABEL[p.role]}</div>
          </div>
          <div style={{ direction: 'rtl' }}>
            <div style={{ fontSize: 8, color: G.soft }}>رقم البطاقة · ID No.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.dark, direction: 'ltr', textAlign: 'right', letterSpacing: 0.4 }}>{p.id_number || '—'}</div>
          </div>
          <div className="flex items-end justify-between">
            <Hologram label={org.card_prefix} />
            {photo && <img src={photo} alt="" aria-hidden style={{ width: 30, height: 38, objectFit: 'cover', borderRadius: 4, filter: 'grayscale(1) contrast(.8)', opacity: 0.32, mixBlendMode: 'multiply' }} />}
          </div>
        </div>
      </div>

      {/* fields */}
      <div className="absolute" style={{ top: 282, insetInline: 18, direction: 'rtl' }}>
        {rows.map(([k, v, hi]) => (
          <div key={k} className="flex items-center justify-between" style={{ height: 20.5, padding: '0 8px', borderRadius: 6, marginBottom: 2.5, background: hi ? G.goldLight : 'rgba(232,243,236,.75)' }}>
            <span style={{ fontSize: 9.5, color: G.soft }}>{k}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, direction: 'ltr', color: hi ? '#7a5a06' : G.ink }}>{v}</span>
          </div>
        ))}
      </div>

      {/* codes + signature */}
      <div className="absolute flex items-end justify-between" style={{ bottom: 40, insetInline: 14, direction: 'rtl' }}>
        <div className="relative" style={{ width: 150, height: 78 }}>
          <div className="absolute" style={{ right: 6, top: 0 }}><Signature org={org} /></div>
          <div className="absolute" style={{ left: -6, top: -40 }}><Stamp org={org} size={66} /></div>
        </div>
        <div className="flex items-end gap-2" style={{ direction: 'ltr' }}>
          <div className="text-center">
            {bar && <img src={bar} alt="" style={{ width: 96, height: 26 }} />}
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6 }}>{p.id_number || ''}</div>
          </div>
          <div className="text-center">
            {account && <img src={account} alt="" style={{ width: 56, height: 56, borderRadius: 4, padding: 2, background: '#fff', boxShadow: `0 0 0 1px ${G.gold}` }} />}
            <div style={{ fontSize: 6.5, color: G.soft, marginTop: 1 }}>حسابي</div>
          </div>
        </div>
      </div>
      <Microtext text={`${org.name_en || org.name} OFFICIAL CARD ${p.id_number || ''}`} y={CARD_H - 40} />
    </Shell>
  );
}

export function CardBack({ p, org }: { p: Profile; org: Org }) {
  const verify = useQr(verifyUrl(p.card_token), 360);
  const host = location.host;
  const rows: [string, string][] = [
    ['Name', p.full_name_en || p.full_name], ['Position', p.position_en || ROLE_LABEL_EN[p.role]], ['ID No.', p.id_number || '—'],
    ['Date of Birth', dmy(p.birth_date)], ['Issued', dmy(p.card_issued)], ['Expires', dmy(p.card_expires)],
  ];
  return (
    <Shell org={org}>
      <Header org={org} en />
      <div className="absolute flex items-center gap-3" style={{ top: 100, insetInline: 18, direction: 'ltr' }}>
        <div style={{ padding: 5, borderRadius: 12, background: '#fff', boxShadow: `0 0 0 2px ${G.gold}, 0 4px 12px rgba(11,58,35,.12)` }}>
          {verify && <img src={verify} alt="" style={{ width: 104, height: 104, display: 'block' }} />}
        </div>
        <div className="flex-1">
          <div className="inline-flex items-center gap-1" style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: G.mid, borderRadius: 7, padding: '2px 9px' }}>✓ VERIFY THIS CARD</div>
          <div style={{ fontSize: 9, color: G.soft, lineHeight: '13px', marginTop: 6 }}>Scan the code to confirm this card is genuine and currently valid, directly from the issuer’s records.</div>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: G.mid, marginTop: 4, wordBreak: 'break-all' }}>{host}</div>
        </div>
      </div>
      <div className="absolute" style={{ top: 224, insetInline: 18, direction: 'ltr' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between" style={{ height: 19, padding: '0 8px', borderRadius: 6, marginBottom: 2, background: 'rgba(232,243,236,.75)' }}>
            <span style={{ fontSize: 9, color: G.soft }}>{k}</span><span style={{ fontSize: 10, fontWeight: 700, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="absolute" style={{ top: 356, insetInline: 18, direction: 'ltr', fontSize: 8.5, lineHeight: '12.5px', color: G.ink }}>
        {(org.address_en || org.address) && <div>📍 {org.address_en || org.address}</div>}
        <div className="flex flex-wrap gap-x-3">
          {org.contact_phone && <span>☎ {org.contact_phone}</span>}
          {org.email && <span>✉ {org.email}</span>}
          {org.website && <span>🌐 {org.website}</span>}
        </div>
        <div style={{ marginTop: 5, padding: '4px 7px', borderRadius: 6, background: G.goldLight, color: '#6d5005', fontSize: 8 }}>
          This card is the property of {org.name_en || org.name}. If found, please return it to the issuer. Any alteration or misuse is prohibited.
        </div>
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: 40, insetInline: 14, direction: 'ltr' }}>
        <Signature org={org} en />
        <div style={{ marginBottom: 6 }}><Stamp org={org} size={70} /></div>
      </div>
      <Microtext text={`VERIFY ${p.id_number || ''} ${org.name_en || org.name}`} y={CARD_H - 40} />
    </Shell>
  );
}
