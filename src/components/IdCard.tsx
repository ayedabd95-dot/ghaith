import { useEffect, useMemo, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Org, Profile } from '../lib/supabase';
import { logoUrl, assetUrl } from '../lib/logo';
import { ROLE_LABEL, ROLE_LABEL_EN, dmy } from '../lib/format';

/**
 * ISO/IEC 7810 ID-1 portrait card, drawn at 340×540 px (≈6.3 px/mm) and printed at 54×85.6 mm.
 * Front is Arabic, back is English. Colours come from the organization; four layouts share the
 * same security layers: guilloche ground, microtext, ghost photo, hologram patch, live verify QR.
 */
export const CARD_W = 340;
export const CARD_H = 540;

export type Template = 'classic' | 'modern' | 'minimal' | 'official';
export const TEMPLATES: { key: Template; label: string; hint: string }[] = [
  { key: 'classic', label: 'كلاسيكي', hint: 'موجة علوية وشريط ذهبي' },
  { key: 'modern', label: 'عصري', hint: 'نصف ملوّن وصورة دائرية' },
  { key: 'minimal', label: 'بسيط', hint: 'أبيض نظيف وشريط جانبي' },
  { key: 'official', label: 'رسمي', hint: 'إطار مزدوج وجدول معلومات' },
];
export const PALETTES: { name: string; primary: string; accent: string }[] = [
  { name: 'أخضر وذهبي', primary: '#0b3a23', accent: '#c99a1e' },
  { name: 'كحلي وذهبي', primary: '#13294b', accent: '#c9a227' },
  { name: 'عنابي وذهبي', primary: '#5c1424', accent: '#d4a64a' },
  { name: 'فيروزي وبرتقالي', primary: '#0e4d57', accent: '#e8833a' },
  { name: 'أزرق وفضي', primary: '#1d4e89', accent: '#9aa8b8' },
  { name: 'بنفسجي وذهبي', primary: '#3d2463', accent: '#d1a742' },
  { name: 'رمادي وأخضر', primary: '#2f3a40', accent: '#3fa36b' },
  { name: 'بني وكريمي', primary: '#4a2f1d', accent: '#d9a86c' },
];

interface Theme { dark: string; mid: string; light: string; row: string; gold: string; goldLight: string; goldInk: string; ink: string; soft: string }

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => '#' + hex(a).map((x, i) => Math.round(x + (hex(b)[i] - x) * t).toString(16).padStart(2, '0')).join('');
const safe = (c: string | null | undefined, d: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : d);

export function themeOf(org: Pick<Org, 'primary_color' | 'accent_color'>): Theme {
  const p = safe(org.primary_color, '#0b3a23'), a = safe(org.accent_color, '#c99a1e');
  return {
    dark: p, mid: mix(p, '#ffffff', 0.16), light: mix(p, '#ffffff', 0.9), row: mix(p, '#ffffff', 0.93),
    gold: a, goldLight: mix(a, '#ffffff', 0.78), goldInk: mix(a, '#000000', 0.5), ink: '#17211c', soft: '#5d6b63',
  };
}

export function verifyUrl(token: string) { return `${location.origin}${import.meta.env.BASE_URL}verify/${token}`; }
export function accountUrl() { return `${location.origin}${import.meta.env.BASE_URL}my-card`; }

function useQr(text: string, color: string, size = 300) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { margin: 0, width: size, errorCorrectionLevel: 'M', color: { dark: color, light: '#ffffff' } }).then(setSrc); }, [text, size, color]);
  return src;
}
function useBarcode(text: string | null) {
  return useMemo(() => {
    if (!text) return '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, text, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6, lineColor: '#17211c', background: 'transparent' });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }, [text]);
}

/* ---------------- shared security & identity pieces ---------------- */

function Guilloche({ seed, t, opacity = 0.16 }: { seed: string; t: Theme; opacity?: number }) {
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
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 3 === 0 ? t.gold : t.mid} strokeWidth="0.45" opacity={opacity} />)}
    </svg>
  );
}

function Microtext({ text, y, t }: { text: string; y: number; t: Theme }) {
  return (
    <div className="absolute inset-x-0 overflow-hidden whitespace-nowrap pointer-events-none" style={{ top: y, fontSize: 3.6, lineHeight: '4px', letterSpacing: 0.3, color: t.mid, opacity: 0.75, direction: 'ltr' }} aria-hidden>
      {Array.from({ length: 30 }, () => text).join(' • ')}
    </div>
  );
}

function Hologram({ label, size = 44 }: { label: string; size?: number }) {
  return (
    <div className="rounded-full grid place-items-center font-bold shrink-0" aria-hidden style={{
      width: size, height: size, fontSize: size * 0.2, letterSpacing: 0.5, color: 'rgba(40,40,60,.55)',
      background: 'conic-gradient(from 30deg, #f9d1e8, #c9e7ff, #d6ffd9, #fff3b8, #f6c8ff, #bfe9ff, #f9d1e8)',
      boxShadow: 'inset 0 0 6px rgba(255,255,255,.9), 0 0 0 1px rgba(150,150,150,.4)',
    }}>
      <div className="rounded-full grid place-items-center" style={{ width: size * 0.77, height: size * 0.77, border: '0.6px dashed rgba(60,60,90,.35)' }}>{label}</div>
    </div>
  );
}

export function Stamp({ org, size = 84 }: { org: Org; size?: number }) {
  const url = assetUrl('ch-logos', org.stamp_path);
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', transform: 'rotate(-10deg)', opacity: 0.9 }} />;
  const ink = '#1d3c8c', r = 50;
  const top = org.name, bottom = (org.name_en || 'OFFICIAL SEAL').toUpperCase();
  const topSize = Math.min(11, 125 / Math.max(top.length, 1) * 1.55);
  const botSize = Math.min(7.6, 112 / Math.max(bottom.length, 1) * 1.45);
  const uid = `${org.id}-${size}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ transform: 'rotate(-12deg)', opacity: 0.85 }} aria-hidden>
      <defs>
        <path id={`st-top-${uid}`} d={`M ${60 - r + 8} 60 A ${r - 8} ${r - 8} 0 0 1 ${60 + r - 8} 60`} />
        <path id={`st-bot-${uid}`} d={`M ${60 - r + 14} 62 A ${r - 14} ${r - 14} 0 0 0 ${60 + r - 14} 62`} />
      </defs>
      <circle cx="60" cy="60" r={r + 6} fill="none" stroke={ink} strokeWidth="2.6" />
      <circle cx="60" cy="60" r={r - 1} fill="none" stroke={ink} strokeWidth="1" />
      <circle cx="60" cy="60" r={r - 22} fill="none" stroke={ink} strokeWidth="1" />
      <text fill={ink} fontSize={topSize} fontWeight="700" fontFamily="IBM Plex Sans Arabic"><textPath href={`#st-top-${uid}`} startOffset="50%" textAnchor="middle">{top}</textPath></text>
      <text fill={ink} fontSize={botSize} fontWeight="700" letterSpacing="0.3" fontFamily="IBM Plex Sans Arabic"><textPath href={`#st-bot-${uid}`} startOffset="50%" textAnchor="middle">{bottom}</textPath></text>
      <text x="60" y="58" textAnchor="middle" fill={ink} fontSize="15">★</text>
      <text x="60" y="72" textAnchor="middle" fill={ink} fontSize="7" fontWeight="700" letterSpacing="0.6">{org.card_prefix}</text>
    </svg>
  );
}

function Signature({ org, en, t, width = 136 }: { org: Org; en?: boolean; t: Theme; width?: number }) {
  const sig = assetUrl('ch-logos', org.signature_path);
  const name = en ? org.director_name_en || org.director_name : org.director_name;
  const title = en ? org.director_title_en || 'Director' : org.director_title || 'مدير المؤسسة';
  return (
    <div className="text-center" style={{ width }}>
      <div className="grid place-items-end justify-center" style={{ height: 34 }}>
        {sig ? <img src={sig} alt="" style={{ maxHeight: 34, maxWidth: width - 16, objectFit: 'contain' }} /> : <div style={{ width: width - 36, borderBottom: `1px solid ${t.soft}` }} />}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.ink, lineHeight: '13px', direction: en ? 'ltr' : 'rtl' }}>{name || '—'}</div>
      <div style={{ fontSize: 8, color: t.soft, lineHeight: '11px', direction: en ? 'ltr' : 'rtl' }}>{title}</div>
    </div>
  );
}

function Photo({ p, t, w, h, round, ring = 3 }: { p: Profile; t: Theme; w: number; h: number; round?: boolean; ring?: number }) {
  const photo = assetUrl('ch-ids', p.photo_path);
  return (
    <div style={{ width: w, height: h, borderRadius: round ? '50%' : 12, padding: ring, background: `linear-gradient(135deg, ${t.gold}, ${t.goldLight}, ${t.gold})`, flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: round ? '50%' : 9, overflow: 'hidden', background: t.light }}>
        {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="w-full h-full grid place-items-center" style={{ fontSize: w * 0.4, fontWeight: 700, color: t.mid }}>{p.full_name.charAt(0)}</div>}
      </div>
    </div>
  );
}

function Ghost({ p }: { p: Profile }) {
  const photo = assetUrl('ch-ids', p.photo_path);
  return photo ? <img src={photo} alt="" aria-hidden style={{ width: 30, height: 38, objectFit: 'cover', borderRadius: 4, filter: 'grayscale(1) contrast(.8)', opacity: 0.32, mixBlendMode: 'multiply' }} /> : null;
}

function Codes({ p, t }: { p: Profile; t: Theme }) {
  const account = useQr(accountUrl(), t.dark, 240);
  const bar = useBarcode(p.id_number);
  return (
    <div className="flex items-end gap-2" style={{ direction: 'ltr' }}>
      <div className="text-center">
        {bar && <img src={bar} alt="" style={{ width: 92, height: 24 }} />}
        <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6 }}>{p.id_number || ''}</div>
      </div>
      <div className="text-center">
        {account && <img src={account} alt="" style={{ width: 54, height: 54, borderRadius: 4, padding: 2, background: '#fff', boxShadow: `0 0 0 1px ${t.gold}` }} />}
        <div style={{ fontSize: 6.5, color: t.soft, marginTop: 1 }}>حسابي</div>
      </div>
    </div>
  );
}

const cardKind = (p: Profile) => (p.role === 'volunteer' ? ['بطاقة متطوع', 'VOLUNTEER'] : ['بطاقة تعريف', 'STAFF ID']);
function frontRows(p: Profile): [string, string, boolean?][] {
  return [
    ['الصفة', p.position || ROLE_LABEL[p.role]],
    ['المواليد', dmy(p.birth_date)],
    ...(p.blood_type ? [['فصيلة الدم', p.blood_type] as [string, string]] : []),
    ['تاريخ الإصدار', dmy(p.card_issued)],
    ['تاريخ النفاذ', dmy(p.card_expires), true],
  ];
}

function Shell({ children, org, t, guilloche = 0.16, bottomWave = true }: { children: ReactNode; org: Org; t: Theme; guilloche?: number; bottomWave?: boolean }) {
  return (
    <div className="id-card relative overflow-hidden bg-white select-none" style={{ width: CARD_W, height: CARD_H, borderRadius: 18, boxShadow: '0 12px 32px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.06)', fontFamily: '"IBM Plex Sans Arabic", sans-serif', color: t.ink }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 60% at 100% 0%, ${t.light} 0%, #fff 55%), #fff` }} />
      <Guilloche seed={org.id} t={t} opacity={guilloche} />
      {children}
      {bottomWave && (
        <svg className="absolute bottom-0 left-0" width={CARD_W} height="34" viewBox={`0 0 ${CARD_W} 34`} aria-hidden>
          <path d={`M0 14 C 90 0, 200 30, ${CARD_W} 8 L ${CARD_W} 34 L 0 34 Z`} fill={t.dark} />
          <path d={`M0 12 C 90 -2, 200 28, ${CARD_W} 6`} fill="none" stroke={t.gold} strokeWidth="1.6" />
        </svg>
      )}
    </div>
  );
}

function OrgLine({ org, t, en, light, size = 42, center }: { org: Org; t: Theme; en?: boolean; light?: boolean; size?: number; center?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${center ? 'justify-center' : ''}`} style={{ direction: en ? 'ltr' : 'rtl' }}>
      <img src={logoUrl(org.logo_path)} alt="" style={{ width: size, height: size, borderRadius: 10, background: '#fff', objectFit: 'contain', padding: 2, boxShadow: `0 0 0 1.5px ${t.gold}` }} />
      <div className="min-w-0" style={{ color: light ? '#fff' : t.dark, textAlign: center ? 'center' : undefined }}>
        <div style={{ fontSize: en ? 13.5 : 15, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{en ? org.name_en || org.name : org.name}</div>
        <div style={{ fontSize: 9, opacity: 0.85, lineHeight: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240, direction: en ? 'rtl' : 'ltr', color: light ? '#fff' : t.soft }}>{en ? org.name : org.name_en || org.tagline || ''}</div>
      </div>
    </div>
  );
}

function WaveHeader({ org, t, en }: { org: Org; t: Theme; en?: boolean }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: 92 }}>
      <svg className="absolute top-0 left-0" width={CARD_W} height="92" viewBox={`0 0 ${CARD_W} 92`} aria-hidden>
        <path d={`M0 0 H${CARD_W} V62 C 250 86, 110 50, 0 78 Z`} fill={t.dark} />
        <path d={`M0 78 C 110 50, 250 86, ${CARD_W} 62`} fill="none" stroke={t.gold} strokeWidth="1.8" />
      </svg>
      <div className="absolute" style={{ top: 22, insetInline: 18 }}><OrgLine org={org} t={t} en={en} light /></div>
    </div>
  );
}

/* ---------------- fronts ---------------- */

function ClassicFront({ p, org, t }: { p: Profile; org: Org; t: Theme }) {
  const [ar, en] = cardKind(p);
  return (
    <Shell org={org} t={t}>
      <WaveHeader org={org} t={t} />
      <div className="absolute flex items-center justify-center gap-2" style={{ top: 94, insetInline: 70, height: 24, borderRadius: 12, background: `linear-gradient(90deg, ${t.gold}, ${t.goldLight}, ${t.gold})`, color: t.dark, fontSize: 11, fontWeight: 700 }}>
        {ar} <span style={{ opacity: 0.6 }}>|</span> <span style={{ direction: 'ltr' }}>{en}</span>
      </div>
      <div className="absolute flex gap-3" style={{ top: 128, insetInline: 18, direction: 'rtl' }}>
        <Photo p={p} t={t} w={112} h={142} />
        <div className="flex-1 flex flex-col justify-between" style={{ paddingTop: 4, paddingBottom: 2 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: '23px', color: t.dark }}>{p.full_name}</div>
            <div style={{ fontSize: 10, color: t.soft, direction: 'ltr', textAlign: 'right', lineHeight: '14px' }}>{p.full_name_en || ''}</div>
            <div className="inline-block mt-1.5" style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: t.mid, borderRadius: 6, padding: '1px 8px' }}>{ROLE_LABEL[p.role]}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: t.soft }}>رقم البطاقة · ID No.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.dark, direction: 'ltr', textAlign: 'right', letterSpacing: 0.4 }}>{p.id_number || '—'}</div>
          </div>
          <div className="flex items-end justify-between"><Hologram label={org.card_prefix} /><Ghost p={p} /></div>
        </div>
      </div>
      <div className="absolute" style={{ top: 282, insetInline: 18, direction: 'rtl' }}>
        {frontRows(p).map(([k, v, hi]) => (
          <div key={k} className="flex items-center justify-between" style={{ height: 20.5, padding: '0 8px', borderRadius: 6, marginBottom: 2.5, background: hi ? t.goldLight : t.row }}>
            <span style={{ fontSize: 9.5, color: t.soft }}>{k}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, direction: 'ltr', color: hi ? t.goldInk : t.ink }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: 40, insetInline: 14, direction: 'rtl' }}>
        <div className="relative" style={{ width: 150, height: 78 }}>
          <div className="absolute" style={{ right: 6, top: 0 }}><Signature org={org} t={t} /></div>
          <div className="absolute" style={{ left: -6, top: -40 }}><Stamp org={org} size={66} /></div>
        </div>
        <Codes p={p} t={t} />
      </div>
      <Microtext text={`${org.name_en || org.name} OFFICIAL CARD ${p.id_number || ''}`} y={CARD_H - 40} t={t} />
    </Shell>
  );
}

function ModernFront({ p, org, t }: { p: Profile; org: Org; t: Theme }) {
  const [ar, en] = cardKind(p);
  const rows = frontRows(p);
  return (
    <Shell org={org} t={t} guilloche={0.12} bottomWave={false}>
      <div className="absolute inset-x-0 top-0" style={{ height: 196, background: `linear-gradient(160deg, ${t.dark} 0%, ${t.mid} 100%)` }}>
        <svg className="absolute inset-0" width={CARD_W} height="196" aria-hidden>
          <path d={`M${CARD_W} 120 L ${CARD_W - 160} 196 L ${CARD_W} 196 Z`} fill={t.gold} opacity="0.9" />
          <path d={`M0 150 L 120 196 L 0 196 Z`} fill="#fff" opacity="0.08" />
          {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={CARD_W - 40} cy={40} r={20 + i * 12} fill="none" stroke="#fff" strokeOpacity="0.06" />)}
        </svg>
        <div className="absolute" style={{ top: 20, insetInline: 18 }}><OrgLine org={org} t={t} light size={38} center /></div>
        <div className="absolute inset-x-0 text-center" style={{ top: 74, color: t.goldLight, fontSize: 10.5, fontWeight: 700, letterSpacing: 1 }}>{ar} • <span style={{ direction: 'ltr' }}>{en}</span></div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 100 }}><Photo p={p} t={t} w={128} h={128} round ring={4} /></div>
      <div className="absolute" style={{ top: 214, right: 26 }}><Hologram label={org.card_prefix} size={36} /></div>
      <div className="absolute inset-x-0 text-center" style={{ top: 236 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.dark, lineHeight: '24px' }}>{p.full_name}</div>
        <div style={{ fontSize: 10, color: t.soft, direction: 'ltr' }}>{p.full_name_en || ''}</div>
        <div className="inline-block mt-1" style={{ fontSize: 9.5, fontWeight: 700, color: t.dark, background: t.goldLight, borderRadius: 999, padding: '1px 12px' }}>{p.position || ROLE_LABEL[p.role]}</div>
      </div>
      <div className="absolute grid grid-cols-2 gap-x-3 gap-y-1.5" style={{ top: 306, insetInline: 22, direction: 'rtl' }}>
        {[['رقم البطاقة', p.id_number || '—'] as [string, string, boolean?], ...rows.slice(1)].map(([k, v, hi]) => (
          <div key={k} style={{ borderInlineStart: `3px solid ${hi ? t.gold : t.mid}`, paddingInlineStart: 7 }}>
            <div style={{ fontSize: 8, color: t.soft }}>{k}</div>
            <div style={{ fontSize: 11, fontWeight: 700, direction: 'ltr', textAlign: 'right', color: hi ? t.goldInk : t.ink }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: 22, insetInline: 14, direction: 'rtl' }}>
        <div className="relative" style={{ width: 150, height: 78 }}>
          <div className="absolute" style={{ right: 6, top: 0 }}><Signature org={org} t={t} /></div>
          <div className="absolute" style={{ left: -6, top: -40 }}><Stamp org={org} size={64} /></div>
        </div>
        <Codes p={p} t={t} />
      </div>
      <div className="absolute inset-x-0 bottom-0" style={{ height: 8, background: `linear-gradient(90deg, ${t.dark}, ${t.gold}, ${t.dark})` }} />
      <Microtext text={`${org.name_en || org.name} OFFICIAL CARD ${p.id_number || ''}`} y={CARD_H - 16} t={t} />
    </Shell>
  );
}

function MinimalFront({ p, org, t }: { p: Profile; org: Org; t: Theme }) {
  const [ar, en] = cardKind(p);
  return (
    <Shell org={org} t={t} guilloche={0.07} bottomWave={false}>
      <div className="absolute inset-y-0" style={{ right: 0, width: 14, background: t.dark }} />
      <div className="absolute inset-y-0" style={{ right: 14, width: 3, background: t.gold }} />
      <div className="absolute" style={{ top: 22, right: 32, left: 18 }}><OrgLine org={org} t={t} size={36} /></div>
      <div className="absolute" style={{ top: 74, right: 32, left: 18, height: 1, background: '#e6e9e7' }} />
      <div className="absolute" style={{ top: 84, right: 32, fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: 1.2 }}>{ar} — <span style={{ direction: 'ltr' }}>{en}</span></div>
      <div className="absolute flex gap-3 items-end" style={{ top: 106, right: 32, left: 18, direction: 'rtl' }}>
        <Photo p={p} t={t} w={118} h={150} ring={2} />
        <div className="flex-1 flex flex-col gap-2 pb-1">
          <div style={{ fontSize: 19, fontWeight: 700, lineHeight: '25px', color: t.ink }}>{p.full_name}</div>
          <div style={{ fontSize: 10, color: t.soft, direction: 'ltr', textAlign: 'right' }}>{p.full_name_en || ''}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.mid }}>{p.position || ROLE_LABEL[p.role]}</div>
          <div className="flex items-center gap-2"><Hologram label={org.card_prefix} size={30} /><Ghost p={p} /></div>
        </div>
      </div>
      <div className="absolute" style={{ top: 276, right: 32, left: 18, direction: 'rtl' }}>
        {[['رقم البطاقة', p.id_number || '—'] as [string, string, boolean?], ...frontRows(p).slice(1)].map(([k, v, hi]) => (
          <div key={k} className="flex items-center justify-between" style={{ height: 28, borderBottom: '1px solid #eceeed' }}>
            <span style={{ fontSize: 10, color: t.soft }}>{k}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, direction: 'ltr', color: hi ? t.goldInk : t.ink }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: 20, right: 28, left: 12, direction: 'rtl' }}>
        <div className="relative" style={{ width: 140, height: 78 }}>
          <div className="absolute" style={{ right: 0, top: 0 }}><Signature org={org} t={t} width={130} /></div>
          <div className="absolute" style={{ left: -4, top: -40 }}><Stamp org={org} size={62} /></div>
        </div>
        <Codes p={p} t={t} />
      </div>
      <Microtext text={`${org.name_en || org.name} OFFICIAL CARD ${p.id_number || ''}`} y={CARD_H - 12} t={t} />
    </Shell>
  );
}

function OfficialFront({ p, org, t }: { p: Profile; org: Org; t: Theme }) {
  const [ar, en] = cardKind(p);
  return (
    <Shell org={org} t={t} guilloche={0.26} bottomWave={false}>
      <div className="absolute pointer-events-none" style={{ inset: 7, border: `3px solid ${t.dark}`, borderRadius: 13 }} />
      <div className="absolute pointer-events-none" style={{ inset: 12, border: `1px solid ${t.gold}`, borderRadius: 9 }} />
      <div className="absolute inset-x-0 text-center" style={{ top: 22 }}>
        <img src={logoUrl(org.logo_path)} alt="" className="mx-auto" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <div style={{ fontSize: 14.5, fontWeight: 700, color: t.dark, marginTop: 2 }}>{org.name}</div>
        <div style={{ fontSize: 9, color: t.soft, direction: 'ltr' }}>{org.name_en || ''}</div>
      </div>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: 100 }}>
        <div style={{ background: t.dark, color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 16px', borderRadius: 3, boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${t.gold}` }}>{ar} — <span style={{ direction: 'ltr' }}>{en}</span></div>
      </div>
      <div className="absolute flex gap-3" style={{ top: 134, insetInline: 22, direction: 'rtl' }}>
        <div className="flex flex-col items-center gap-2">
          <Photo p={p} t={t} w={112} h={142} ring={2} />
          <div className="flex items-center gap-2"><Ghost p={p} /><Hologram label={org.card_prefix} size={34} /></div>
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: '21px', color: t.ink }}>{p.full_name}</div>
          <div style={{ fontSize: 9.5, color: t.soft, direction: 'ltr', textAlign: 'right' }}>{p.full_name_en || ''}</div>
          <table className="w-full mt-2.5" style={{ borderCollapse: 'collapse', fontSize: 10 }}>
            <tbody>
              {[['رقم البطاقة', p.id_number || '—'] as [string, string, boolean?], ...frontRows(p)].map(([k, v, hi]) => (
                <tr key={k}>
                  <td style={{ border: `1px solid ${t.light}`, background: t.row, color: t.soft, padding: '6px 6px', width: 70 }}>{k}</td>
                  <td style={{ border: `1px solid ${t.light}`, padding: '6px 6px', fontWeight: 700, direction: 'ltr', textAlign: 'right', color: hi ? t.goldInk : t.ink, background: hi ? t.goldLight : '#fff' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: 24, insetInline: 20, direction: 'rtl' }}>
        <div className="relative" style={{ width: 146, height: 78 }}>
          <div className="absolute" style={{ right: 0, top: 0 }}><Signature org={org} t={t} /></div>
          <div className="absolute" style={{ left: -10, top: -42 }}><Stamp org={org} size={68} /></div>
        </div>
        <Codes p={p} t={t} />
      </div>
      <Microtext text={`${org.name_en || org.name} OFFICIAL CARD ${p.id_number || ''}`} y={CARD_H - 19} t={t} />
    </Shell>
  );
}

export function CardFront({ p, org, template }: { p: Profile; org: Org; template?: Template }) {
  const t = themeOf(org);
  const tpl = template ?? (org.card_template as Template) ?? 'classic';
  if (tpl === 'modern') return <ModernFront p={p} org={org} t={t} />;
  if (tpl === 'minimal') return <MinimalFront p={p} org={org} t={t} />;
  if (tpl === 'official') return <OfficialFront p={p} org={org} t={t} />;
  return <ClassicFront p={p} org={org} t={t} />;
}

/* ---------------- back (English), dressed to match the chosen template ---------------- */

export function CardBack({ p, org, template }: { p: Profile; org: Org; template?: Template }) {
  const t = themeOf(org);
  const tpl = template ?? (org.card_template as Template) ?? 'classic';
  const verify = useQr(verifyUrl(p.card_token), t.dark, 360);
  const rows: [string, string][] = [
    ['Name', p.full_name_en || p.full_name], ['Position', p.position_en || ROLE_LABEL_EN[p.role]], ['ID No.', p.id_number || '—'],
    ['Date of Birth', dmy(p.birth_date)], ['Issued', dmy(p.card_issued)], ['Expires', dmy(p.card_expires)],
  ];
  const inset = tpl === 'minimal' ? { left: 18, right: 32 } : tpl === 'official' ? { left: 22, right: 22 } : { left: 18, right: 18 };
  return (
    <Shell org={org} t={t} guilloche={tpl === 'official' ? 0.26 : tpl === 'minimal' ? 0.07 : 0.16} bottomWave={tpl === 'classic'}>
      {tpl === 'classic' && <WaveHeader org={org} t={t} en />}
      {tpl === 'modern' && (
        <div className="absolute inset-x-0 top-0" style={{ height: 86, background: `linear-gradient(160deg, ${t.dark}, ${t.mid})` }}>
          <div className="absolute" style={{ top: 22, insetInline: 18 }}><OrgLine org={org} t={t} en light size={38} /></div>
          <div className="absolute inset-x-0 bottom-0" style={{ height: 4, background: t.gold }} />
        </div>
      )}
      {tpl === 'minimal' && (<>
        <div className="absolute inset-y-0" style={{ right: 0, width: 14, background: t.dark }} />
        <div className="absolute inset-y-0" style={{ right: 14, width: 3, background: t.gold }} />
        <div className="absolute" style={{ top: 22, ...inset }}><OrgLine org={org} t={t} en size={36} /></div>
        <div className="absolute" style={{ top: 74, ...inset, height: 1, background: '#e6e9e7' }} />
      </>)}
      {tpl === 'official' && (<>
        <div className="absolute pointer-events-none" style={{ inset: 7, border: `3px solid ${t.dark}`, borderRadius: 13 }} />
        <div className="absolute pointer-events-none" style={{ inset: 12, border: `1px solid ${t.gold}`, borderRadius: 9 }} />
        <div className="absolute" style={{ top: 24, ...inset }}><OrgLine org={org} t={t} en size={38} /></div>
      </>)}

      <div className="absolute flex items-center gap-3" style={{ top: 100, ...inset, direction: 'ltr' }}>
        <div style={{ padding: 5, borderRadius: 12, background: '#fff', boxShadow: `0 0 0 2px ${t.gold}, 0 4px 12px rgba(0,0,0,.1)` }}>
          {verify && <img src={verify} alt="" style={{ width: 104, height: 104, display: 'block' }} />}
        </div>
        <div className="flex-1">
          <div className="inline-flex items-center gap-1" style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: t.mid, borderRadius: 7, padding: '2px 9px' }}>✓ VERIFY THIS CARD</div>
          <div style={{ fontSize: 9, color: t.soft, lineHeight: '13px', marginTop: 6 }}>Scan the code to confirm this card is genuine and currently valid, directly from the issuer’s records.</div>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: t.mid, marginTop: 4, wordBreak: 'break-all' }}>{location.host}</div>
        </div>
      </div>
      <div className="absolute" style={{ top: 224, ...inset, direction: 'ltr' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between" style={tpl === 'minimal'
            ? { height: 20, borderBottom: '1px solid #eceeed' }
            : { height: 19, padding: '0 8px', borderRadius: tpl === 'official' ? 2 : 6, marginBottom: 2, background: t.row }}>
            <span style={{ fontSize: 9, color: t.soft }}>{k}</span><span style={{ fontSize: 10, fontWeight: 700, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="absolute" style={{ top: 356, ...inset, direction: 'ltr', fontSize: 8.5, lineHeight: '12.5px', color: t.ink }}>
        {(org.address_en || org.address) && <div>📍 {org.address_en || org.address}</div>}
        <div className="flex flex-wrap gap-x-3">
          {org.contact_phone && <span>☎ {org.contact_phone}</span>}
          {org.email && <span>✉ {org.email}</span>}
          {org.website && <span>🌐 {org.website}</span>}
        </div>
        <div style={{ marginTop: 5, padding: '4px 7px', borderRadius: 6, background: t.goldLight, color: t.goldInk, fontSize: 8 }}>
          This card is the property of {org.name_en || org.name}. If found, please return it to the issuer. Any alteration or misuse is prohibited.
        </div>
      </div>
      <div className="absolute flex items-end justify-between" style={{ bottom: tpl === 'classic' ? 40 : 24, ...inset, direction: 'ltr' }}>
        <Signature org={org} en t={t} />
        <div style={{ marginBottom: 6 }}><Stamp org={org} size={70} /></div>
      </div>
      {tpl === 'modern' && <div className="absolute inset-x-0 bottom-0" style={{ height: 8, background: `linear-gradient(90deg, ${t.dark}, ${t.gold}, ${t.dark})` }} />}
      <Microtext text={`VERIFY ${p.id_number || ''} ${org.name_en || org.name}`} y={tpl === 'classic' ? CARD_H - 40 : CARD_H - 16} t={t} />
    </Shell>
  );
}
