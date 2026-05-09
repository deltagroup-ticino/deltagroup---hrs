// ╔══════════════════════════════════════════════════════════════════╗
// ║  DELTAgroup HRS — Rapporto Giornaliero v1.0                     ║
// ║  App per JAS · Impiego HRS Stadio                               ║
// ╚══════════════════════════════════════════════════════════════════╝

const SUPABASE_URL = "https://golheevkvfqcpgovnawj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGhlZXZrdmZxY3Bnb3ZuYXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDIwODMsImV4cCI6MjA4OTgxODA4M30.M6S4oxVB112VBj9CZ8ZSFW79Kz7rJGs9tk1qpGhneWI";
const TELEGRAM_BOT_TOKEN = "8669589385:AAGeMup74PCzf6ms7WRHWBK9AMMfVEGdxzw";
const TELEGRAM_CHAT_ID = "8378245455";
const PIN_JAS   = "052026";   // Responsabile impiego
const PIN_ADMIN = "101318";   // Amministratore (sola lettura)
const HRS_PREFIX = "HRS - Stadio";
const ORANGE = "#f97316";
const ORANGE_DARK = "#ea580c";
const APP_VERSION = "v1.3";

import { useState, useEffect, useCallback } from "react";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
let _sb = null;
async function sb() {
  if (_sb) return _sb;
  if (!window.supabase) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return _sb;
}

// ── TELEGRAM ──────────────────────────────────────────────────────────────────
async function sendTelegram(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch (e) { console.warn('Telegram:', e); }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmtDateLong = iso => { if (!iso) return ''; const d = new Date(iso+'T12:00:00'); const DN=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],MN=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']; return `${DN[d.getDay()]} ${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDateShort = iso => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtTime = t => { if (!t) return '—'; const ts = String(t); return ts.length >= 5 ? ts.slice(0,5) : ts; };
const calcOre = (inizio, fine, pausa) => { if (!inizio||!fine) return 0; const [ih,im]=inizio.split(':').map(Number),[fh,fm]=fine.split(':').map(Number); const min=(fh*60+fm)-(ih*60+im)-(parseInt(pausa)||0); return Math.max(0,Math.round(min/60*100)/100); };
const getMonday = () => { const d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); d.setDate(diff);d.setHours(0,0,0,0);return d; };
const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAY_SHORT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MON_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// ── AREE ──────────────────────────────────────────────────────────────────────
const AREE_FISSE = [
  { id:'AS', label:'AS', nome:'Arena Sportiva',   emoji:'🏟️', bg:'#2563eb', light:'#eff6ff', border:'#bfdbfe' },
  { id:'PS', label:'PS', nome:'Palazzetto Sport',  emoji:'🏀', bg:'#16a34a', light:'#f0fdf4', border:'#bbf7d0' },
  { id:'GF', label:'GF', nome:'Glass Floor',       emoji:'🪟', bg:'#7c3aed', light:'#f5f3ff', border:'#ddd6fe' },
  { id:'ASS',label:'⛔', nome:'Assente',            emoji:'⛔', bg:'#dc2626', light:'#fef2f2', border:'#fecaca' },
];
const LS_BASE = { label:'LS', nome:'Lavori Speciali', emoji:'🔧', bg:'#f59e0b', light:'#fffbeb', border:'#fcd34d' };

// ── PDF ───────────────────────────────────────────────────────────────────────
// Carica html2pdf.js dinamicamente (una sola volta)
let html2pdfPromise = null;
const loadHtml2Pdf = () => {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (html2pdfPromise) return html2pdfPromise;
  html2pdfPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = () => resolve(window.html2pdf);
    s.onerror = () => { html2pdfPromise = null; reject(new Error('Caricamento libreria PDF fallito (verifica connessione)')); };
    document.head.appendChild(s);
  });
  return html2pdfPromise;
};

// Overlay loading (semplice, inline DOM, indipendente da React)
const showPdfLoading = (msg) => {
  if (document.getElementById('pdf-loading-ov')) return;
  const ov = document.createElement('div');
  ov.id = 'pdf-loading-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Arial,sans-serif;';
  ov.innerHTML = `<style>@keyframes spinPdf{to{transform:rotate(360deg)}}</style><div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinPdf 0.8s linear infinite;margin-bottom:16px"></div><div style="font-weight:600;font-size:15px">${msg||'Generazione PDF...'}</div>`;
  document.body.appendChild(ov);
};
const hidePdfLoading = () => { const ov=document.getElementById('pdf-loading-ov'); if(ov) ov.remove(); };

// Download fallback se share non supportata
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// Genera PDF da HTML e lo condivide (o scarica se non possibile)
async function generaECondividiPdf(innerHtml, fileName, fileTitle, fileText) {
  showPdfLoading('Generazione PDF...');
  // Crea container nascosto fuori viewport
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;padding:40px 45px;font-family:Arial,sans-serif;font-size:12px;color:#111;box-sizing:border-box;';
  container.innerHTML = innerHtml;
  document.body.appendChild(container);
  try {
    const html2pdf = await loadHtml2Pdf();
    const blob = await html2pdf().set({
      margin: [8,8,8,8],
      filename: fileName,
      image: { type:'jpeg', quality:0.95 },
      html2canvas: { scale:2, useCORS:true, backgroundColor:'#ffffff' },
      jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
    }).from(container).output('blob');

    const file = new File([blob], fileName, { type:'application/pdf' });
    let condiviso = false;
    if (navigator.canShare && navigator.canShare({ files:[file] })) {
      try {
        await navigator.share({ title:fileTitle, text:fileText, files:[file] });
        condiviso = true;
      } catch(e) {
        if (e.name === 'AbortError') { condiviso = true; } // utente ha annullato, non scaricare
      }
    }
    if (!condiviso) downloadBlob(blob, fileName);
  } catch(e) {
    console.error('PDF error:', e);
    alert('Errore generazione PDF: ' + (e.message||e));
  } finally {
    document.body.removeChild(container);
    hidePdfLoading();
  }
}

function apriPdfRapporto(area, agentiSez, osservazione, dataIso) {
  const dateFmt = fmtDateLong(dataIso);
  const sezNome = area.nome;
  const fileTitle = `Rapporto di Servizio - ${sezNome} - ${fmtDateShort(dataIso)}`;
  const fileName  = `rapporto_${sezNome.replace(/\s+/g,'_').toLowerCase()}_${dataIso}.pdf`;
  const fileText  = `Rapporto di Servizio HRS - ${sezNome} - ${dateFmt}`;

  const totOre = agentiSez.filter(a=>a.area!=='ASS').reduce((t,a)=>t+calcOre(a.inizio,a.fine,a.pausa),0);

  const righe = agentiSez.map(a => {
    if (a.area==='ASS') return `<tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${a.nome}</td><td colspan="3" style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600">ASSENTE${a.nota?' — '+a.nota:''}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">—</td></tr>`;
    const ore = calcOre(a.inizio,a.fine,a.pausa);
    return `<tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${a.nome}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${fmtTime(a.inizio)}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${fmtTime(a.fine)}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${a.pausa ?? 30}'</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${ore.toFixed(2)}h</td></tr>`;
  }).join('');

  const ossHtml = osservazione
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:16px"><div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Osservazioni</div><div style="font-size:12px;color:#374151;line-height:1.6">${osservazione}</div></div>` : '';

  const innerHtml = `
  <div style="border-bottom:3px solid #c41230;padding-bottom:12px;margin-bottom:20px">
    <div style="font-size:17px;font-weight:900;color:#c41230">DELTAgroup Security &amp; Services AG</div>
    <div style="font-size:11px;color:#555;margin-top:2px">Filiale Ticino</div>
    <div style="font-size:16px;font-weight:700;color:#111;margin-top:12px">Rapporto di Servizio</div>
    <div style="font-size:13px;color:#374151;margin-top:4px">${sezNome} &nbsp;·&nbsp; ${dateFmt}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr style="background:#f9fafb">
      <th style="padding:8px 10px;border-bottom:2px solid #c41230;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Collaboratore</th>
      <th style="padding:8px 10px;border-bottom:2px solid #c41230;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Inizio</th>
      <th style="padding:8px 10px;border-bottom:2px solid #c41230;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Fine</th>
      <th style="padding:8px 10px;border-bottom:2px solid #c41230;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Pausa</th>
      <th style="padding:8px 10px;border-bottom:2px solid #c41230;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Ore eff.</th>
    </tr></thead>
    <tbody>${righe}</tbody>
  </table>
  ${ossHtml}
  <div style="border-top:2px solid #c41230;margin-top:20px;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#9ca3af">DELTAgroup HRS ${APP_VERSION} — ${fmtDateShort(todayIso())}</div>
    <div style="font-size:15px;font-weight:900;color:#c41230">TOTALE ORE: ${totOre.toFixed(2)}h</div>
  </div>`;

  generaECondividiPdf(innerHtml, fileName, fileTitle, fileText);
}

function apriPdfGenerale(agenti, datiAgenti, osservazioni, lavorazioni, dataIso) {
  const dateFmt = fmtDateLong(dataIso);
  const fileTitle = `Rapporto Generale HRS - ${fmtDateShort(dataIso)}`;
  const fileName  = `rapporto_generale_hrs_${dataIso}.pdf`;
  const fileText  = `Rapporto Generale HRS Stadio - ${dateFmt}`;
  const aree = [...AREE_FISSE, ...lavorazioni.map(l=>({...LS_BASE,id:`LS_${l.id}`,nome:l.nome}))];
  let totOreGlobale = 0;
  let sezioniHtml = '';
  aree.forEach(area => {
    const agentiSez = agenti.filter(a=>datiAgenti[a.id]?.area===area.id);
    if (agentiSez.length===0) return;
    const totSez = agentiSez.filter(()=>area.id!=='ASS').reduce((t,a)=>{const d=datiAgenti[a.id]||{};return t+calcOre(d.inizio,d.fine,d.pausa);},0);
    totOreGlobale += totSez;
    const righe = agentiSez.map(a=>{
      const d=datiAgenti[a.id]||{};
      if(d.area==='ASS') return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${a.nome}</td><td colspan="3" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#dc2626">ASSENTE${d.nota?' — '+d.nota:''}</td><td style="padding:6px 10px;text-align:center">—</td></tr>`;
      const ore=calcOre(d.inizio,d.fine,d.pausa);
      return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${a.nome}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${fmtTime(d.inizio)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${fmtTime(d.fine)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${d.pausa ?? 30}'</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${ore.toFixed(2)}h</td></tr>`;
    }).join('');
    const ossSezione = osservazioni[area.id]||'';
    sezioniHtml += `<div style="margin-bottom:18px"><div style="background:#f3f4f6;border-left:3px solid #c41230;padding:6px 12px;margin-bottom:6px;font-weight:700;font-size:12px">${area.nome} — tot. ${totSez.toFixed(2)}h</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="padding:5px 8px;border-bottom:1px solid #c41230;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Collaboratore</th><th style="padding:5px 8px;border-bottom:1px solid #c41230;text-align:center;font-size:10px;color:#6b7280">Inizio</th><th style="padding:5px 8px;border-bottom:1px solid #c41230;text-align:center;font-size:10px;color:#6b7280">Fine</th><th style="padding:5px 8px;border-bottom:1px solid #c41230;text-align:center;font-size:10px;color:#6b7280">Pausa</th><th style="padding:5px 8px;border-bottom:1px solid #c41230;text-align:center;font-size:10px;color:#6b7280">Ore</th></tr></thead><tbody>${righe}</tbody></table>${ossSezione?`<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:6px 10px;margin-top:4px;font-size:10px;color:#374151"><b>Osservazioni:</b> ${ossSezione}</div>`:''}</div>`;
  });
  const innerHtml = `<div style="border-bottom:3px solid #c41230;padding-bottom:12px;margin-bottom:20px"><div style="font-size:17px;font-weight:900;color:#c41230">DELTAgroup Security &amp; Services AG</div><div style="font-size:11px;color:#555;margin-top:2px">Filiale Ticino</div><div style="font-size:16px;font-weight:700;color:#111;margin-top:12px">Rapporto di Servizio — Riepilogo Generale</div><div style="font-size:13px;color:#374151;margin-top:4px">HRS Stadio &nbsp;·&nbsp; ${dateFmt}</div></div>${sezioniHtml}<div style="border-top:2px solid #c41230;margin-top:20px;padding-top:10px;display:flex;justify-content:space-between;align-items:center"><div style="font-size:9px;color:#9ca3af">DELTAgroup HRS ${APP_VERSION} — ${fmtDateShort(todayIso())}</div><div style="font-size:15px;font-weight:900;color:#c41230">TOTALE ORE GIORNATA: ${totOreGlobale.toFixed(2)}h</div></div>`;

  generaECondividiPdf(innerHtml, fileName, fileTitle, fileText);
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const tap = v => { if (pin.length < 6) setPin(p => p+v); };
  const del = () => setPin(p => p.slice(0,-1));
  const doLogin = () => {
    if (pin === PIN_JAS)   { onLogin('jas'); }
    else if (pin === PIN_ADMIN) { onLogin('admin'); }
    else { setErr(true); setTimeout(() => { setErr(false); setPin(''); }, 800); }
  };
  const S = { height:'100vh', background:'#111827', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 2rem' };
  return (
    <div style={S}>
      <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
        <svg width="72" height="72" viewBox="0 0 512 512" style={{ margin:'0 auto 16px', display:'block' }}><rect width="512" height="512" rx="90" ry="90" fill={ORANGE}/><polygon points="256,92 422,402 90,402" fill="none" stroke="#FFFFFF" strokeWidth="42" strokeLinejoin="round"/></svg>
        <div style={{ fontSize:'2.2rem', fontWeight:900, color:'#fff', letterSpacing:'0.12em' }}>HRS</div>
        <div style={{ color:'#9ca3af', fontSize:'0.85rem', marginTop:4 }}>Rapporto Giornaliero</div>
        <div style={{ color:'#6b7280', fontSize:'0.7rem', marginTop:2 }}>DELTAgroup Security &amp; Services AG</div>
      </div>
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'2rem' }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${i<pin.length?(err?'#ef4444':ORANGE):'#4b5563'}`, background:i<pin.length?(err?'#ef4444':ORANGE):'transparent', transition:'all 0.15s' }} />
        ))}
      </div>
      {err && <div style={{ color:'#f87171', fontSize:'0.85rem', marginBottom:'0.75rem', marginTop:'-1rem' }}>PIN non corretto</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', width:'100%', maxWidth:280, marginBottom:'1.25rem' }}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((t,i) => (
          t===''?<div key={i}/>:
          t==='⌫'?<button key={i} onClick={del} style={{ height:64, borderRadius:16, background:'#374151', color:'#fff', border:'none', fontSize:'1.5rem', cursor:'pointer' }}>{t}</button>:
          <button key={i} onClick={()=>tap(t)} style={{ height:64, borderRadius:16, background:'#1f2937', color:'#fff', border:'1px solid #374151', fontSize:'1.5rem', fontWeight:600, cursor:'pointer' }}>{t}</button>
        ))}
      </div>
      <button onClick={doLogin} style={{ width:'100%', maxWidth:280, height:56, borderRadius:16, background:ORANGE, color:'#fff', fontSize:'1.1rem', fontWeight:700, border:'none', cursor:'pointer' }}>
        Accedi
      </button>
    </div>
  );
}

// ── STATUS BANNER ────────────────────────────────────────────────────────────
function StatusBanner({ reportOggi, reportIeri }) {
  const oT = t => t ? new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}) : '';
  const items = [
    { label:'Ieri', r:reportIeri, okColor:'#f0fdf4', okBorder:'#bbf7d0', noColor:'#fef2f2', noBorder:'#fecaca', okText:`✓ Inviato${reportIeri?.submitted_at?' '+oT(reportIeri.submitted_at):''}`, noText:'⚠️ Non inviato', okTc:'#16a34a', noTc:'#dc2626' },
    { label:'Oggi', r:reportOggi, okColor:'#f0fdf4', okBorder:'#bbf7d0', noColor:'#fffbeb', noBorder:'#fde68a', okText:`✓ Inviato${reportOggi?.submitted_at?' '+oT(reportOggi.submitted_at):''}${reportOggi?.version>1?' · v'+reportOggi.version:''}`, noText:'⏳ Da inviare', okTc:'#16a34a', noTc:'#92400e' },
  ];
  return (
    <div style={{ display:'flex', gap:8, padding:'8px 12px', background:'#fff', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
      {items.map(it => (
        <div key={it.label} style={{ flex:1, background:it.r?it.okColor:it.noColor, border:`1px solid ${it.r?it.okBorder:it.noBorder}`, borderRadius:10, padding:'6px 10px' }}>
          <div style={{ fontSize:'0.62rem', color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{it.label}</div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:it.r?it.okTc:it.noTc, marginTop:1 }}>{it.r?it.okText:it.noText}</div>
        </div>
      ))}
    </div>
  );
}

// ── MODALE AGENTE ────────────────────────────────────────────────────────────
function ModaleAgente({ agente, dati, onChange, onChiudi, lavorazioni }) {
  const tutteAree = [
    ...AREE_FISSE,
    ...lavorazioni.map(l => ({...LS_BASE, id:`LS_${l.id}`, label:l.nome.slice(0,6), nome:l.nome}))
  ];
  const area = tutteAree.find(a => a.id === dati.area);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'1.25rem 1.25rem 2rem', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#111827' }}>{agente.nome}</div>
            {agente.extra && <span style={{ background:'#ffedd5', color:'#c2410c', fontSize:'0.7rem', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>aggiunto</span>}
            {agente.shift_inizio && <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:3 }}>Pianificato: {agente.shift_inizio}–{agente.shift_fine}</div>}
          </div>
          <button onClick={onChiudi} style={{ width:36, height:36, borderRadius:'50%', background:'#f3f4f6', border:'none', fontSize:'1.3rem', cursor:'pointer', fontWeight:700, flexShrink:0 }}>×</button>
        </div>
        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Area di servizio</div>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(tutteAree.length,4)},1fr)`, gap:8, marginBottom:'1.25rem' }}>
          {tutteAree.map(a => (
            <button key={a.id} onClick={()=>onChange({...dati,area:dati.area===a.id?null:a.id})}
              style={{ padding:'0.9rem 4px', borderRadius:14, border:dati.area===a.id?'none':'2px solid #e5e7eb',
                background:dati.area===a.id?a.bg:'#f9fafb', color:dati.area===a.id?'#fff':'#6b7280',
                fontWeight:800, fontSize:'0.78rem', cursor:'pointer', textAlign:'center', lineHeight:1.2 }}>
              {a.label}
            </button>
          ))}
        </div>
        {dati.area && dati.area!=='ASS' && <>
          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Orario</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:10, marginBottom:'1rem' }}>
            {[{label:'Inizio',key:'inizio',def:'07:00'},{label:'Fine',key:'fine',def:'17:00'}].map(f=>(
              <div key={f.key}>
                <div style={{ fontSize:'0.72rem', color:'#6b7280', marginBottom:4 }}>{f.label}</div>
                <input type="time" value={dati[f.key]||f.def} onChange={e=>onChange({...dati,[f.key]:e.target.value})}
                  style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:12, padding:'0.75rem 0.5rem', fontSize:'1rem', background:'#f9fafb', boxSizing:'border-box' }}/>
              </div>
            ))}
            <div>
              <div style={{ fontSize:'0.72rem', color:'#6b7280', marginBottom:4 }}>Pausa'</div>
              <select value={dati.pausa ?? '30'} onChange={e=>onChange({...dati,pausa:e.target.value})}
                style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:12, padding:'0.75rem 4px', fontSize:'1rem', background:'#f9fafb' }}>
                {['0','15','30','45','60'].map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <textarea value={dati.nota||''} onChange={e=>onChange({...dati,nota:e.target.value})}
            placeholder="Nota agente…" rows={2}
            style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:12, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#f9fafb', boxSizing:'border-box', marginBottom:'1rem' }}/>
        </>}
        {dati.area==='ASS' && (
          <textarea value={dati.nota||''} onChange={e=>onChange({...dati,nota:e.target.value})}
            placeholder="Motivo assenza…" rows={2}
            style={{ width:'100%', border:'2px solid #fecaca', borderRadius:12, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#fef2f2', boxSizing:'border-box', marginBottom:'1rem' }}/>
        )}
        <button onClick={onChiudi}
          style={{ width:'100%', padding:'1rem', borderRadius:16, border:'none', background:area?area.bg:'#e5e7eb', color:area?'#fff':'#9ca3af', fontWeight:800, fontSize:'1rem', cursor:'pointer' }}>
          {dati.area?'Salva':'Chiudi'}
        </button>
      </div>
    </div>
  );
}

// ── PICKER COLLABORATORI ──────────────────────────────────────────────────────
function PickerCollaboratori({ tuttiAgenti, nomiGiaPresenti, onScegli, onChiudi }) {
  const [cerca, setCerca] = useState('');
  const filtrati = tuttiAgenti.filter(a => a.name.toLowerCase().includes(cerca.toLowerCase()));
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'1.25rem', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <span style={{ fontWeight:800, fontSize:'1rem', color:'#111827' }}>Aggiungi collaboratore</span>
          <button onClick={onChiudi} style={{ width:36, height:36, borderRadius:'50%', background:'#f3f4f6', border:'none', fontSize:'1.3rem', cursor:'pointer', fontWeight:700 }}>×</button>
        </div>
        <input value={cerca} onChange={e=>setCerca(e.target.value)} placeholder="Cerca nome…" autoFocus
          style={{ border:'2px solid #e5e7eb', borderRadius:14, padding:'0.85rem 1rem', fontSize:'1rem', marginBottom:'0.75rem', background:'#f9fafb' }}/>
        <div style={{ overflowY:'auto', flex:1 }}>
          {filtrati.length===0 && <div style={{ textAlign:'center', color:'#9ca3af', padding:'2rem', fontSize:'0.9rem' }}>Nessun risultato</div>}
          {filtrati.map(a => {
            const presente = nomiGiaPresenti.includes(a.name);
            return (
              <button key={a.id} onClick={()=>!presente&&onScegli(a)} disabled={presente}
                style={{ width:'100%', textAlign:'left', padding:'0.9rem 1rem', background:'none', border:'none', borderBottom:'1px solid #f3f4f6', fontSize:'1rem', fontWeight:600,
                  color:presente?'#d1d5db':'#111827', cursor:presente?'default':'pointer' }}>
                {a.name}
                {presente && <span style={{ fontSize:'0.7rem', color:'#d1d5db', marginLeft:8, fontWeight:400 }}>già pianificato</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MODALE CONDIVIDI ──────────────────────────────────────────────────────────
function ModaleCondividi({ agenti, datiAgenti, osservazioni, lavorazioni, dataOggi, onChiudi }) {
  const aree = [
    ...AREE_FISSE,
    ...lavorazioni.map(l => ({...LS_BASE, id:`LS_${l.id}`, nome:l.nome}))
  ];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'1.25rem 1.25rem 2rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <span style={{ fontWeight:800, fontSize:'1rem', color:'#111827' }}>📤 Condividi rapporto</span>
          <button onClick={onChiudi} style={{ width:36, height:36, borderRadius:'50%', background:'#f3f4f6', border:'none', fontSize:'1.3rem', cursor:'pointer', fontWeight:700 }}>×</button>
        </div>
        <div style={{ fontSize:'0.8rem', color:'#6b7280', marginBottom:'1rem' }}>Scegli la sezione da condividere:</div>
        {aree.map(area => {
          const agentiSez = agenti.filter(a => datiAgenti[a.id]?.area===area.id);
          if (agentiSez.length===0) return null;
          const datiSez = agentiSez.map(a => ({ nome:a.nome, area:area.id, ...datiAgenti[a.id] }));
          const oss = osservazioni[area.id]||'';
          return (
            <button key={area.id} onClick={()=>{ apriPdfRapporto(area, datiSez, oss, dataOggi); onChiudi(); }}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'1rem', background:area.light, border:`1px solid ${area.border}`, borderRadius:14, marginBottom:8, cursor:'pointer' }}>
              <span style={{ fontSize:'1.25rem' }}>{area.emoji}</span>
              <div style={{ textAlign:'left', flex:1 }}>
                <div style={{ fontWeight:700, color:'#111827', fontSize:'0.9rem' }}>{area.nome}</div>
                <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>{agentiSez.length} agenti</div>
              </div>
              <span style={{ color:'#9ca3af' }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── VISTA OGGI ────────────────────────────────────────────────────────────────
function VistaOggi({ agenti, setAgenti, datiAgenti, setDatiAgenti, osservazioni, setOsservazioni, lavorazioni, setLavorazioni, tuttiAgenti, inviato, setInviato, reportOggi, setReportOggi, dataOggi }) {
  const [modaleAgente, setModaleAgente] = useState(null);
  const [picker, setPicker] = useState(false);
  const [addLav, setAddLav] = useState(false);
  const [nomeLav, setNomeLav] = useState('');
  const [conferma, setConferma] = useState(false);
  const [showCondividi, setShowCondividi] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [notaGen, setNotaGen] = useState('');

  const upd = (id,d) => setDatiAgenti(p=>({...p,[id]:d}));
  const nonAss = agenti.filter(a=>!datiAgenti[a.id]?.area);
  const assegnati = agenti.length - nonAss.length;
  const agenteAperto = modaleAgente!==null ? agenti.find(a=>a.id===modaleAgente) : null;

  const doInvia = async () => {
    setSalvando(true);
    try {
      const c = await sb();
      const entries = agenti.map(ag => ({
        agent_id: ag.extra ? null : ag.id,
        agent_name: ag.nome,
        area: datiAgenti[ag.id]?.area || null,
        lavorazione_nome: (datiAgenti[ag.id]?.area||'').startsWith('LS_') ? lavorazioni.find(l=>`LS_${l.id}`===datiAgenti[ag.id]?.area)?.nome : null,
        inizio: datiAgenti[ag.id]?.inizio || null,
        fine: datiAgenti[ag.id]?.fine || null,
        pausa: parseInt(datiAgenti[ag.id]?.pausa ?? 30),
        nota: datiAgenti[ag.id]?.nota || null,
        is_extra: ag.extra||false,
        shift_inizio: ag.shift_inizio||null,
        shift_fine: ag.shift_fine||null,
      })).filter(e=>e.area);

      const sections = Object.entries(osservazioni).filter(([,v])=>v).map(([area,osservazione])=>({
        area, osservazione,
        lavorazione_nome: area.startsWith('LS_') ? lavorazioni.find(l=>`LS_${l.id}`===area)?.nome : null
      }));

      let reportId;
      if (reportOggi) {
        // Verifica che il rapporto esista ancora in DB (potrebbe essere stato eliminato da admin)
        const { data:existing } = await c.from('hrs_reports').select('id').eq('id',reportOggi.id).maybeSingle();
        if (existing) {
          await c.from('hrs_reports').update({ updated_at:new Date().toISOString(), version:(reportOggi.version||1)+1, nota_generale:notaGen, status:'corrected' }).eq('id',reportOggi.id);
          reportId = reportOggi.id;
          await c.from('hrs_report_entries').delete().eq('report_id',reportId);
          await c.from('hrs_report_sections').delete().eq('report_id',reportId);
        } else {
          // Rapporto eliminato da admin — crea nuovo
          const { data } = await c.from('hrs_reports').insert({ date:dataOggi, nota_generale:notaGen, status:'submitted', version:1 }).select().single();
          reportId = data.id;
        }
      } else {
        const { data } = await c.from('hrs_reports').insert({ date:dataOggi, nota_generale:notaGen, status:'submitted', version:1 }).select().single();
        reportId = data.id;
      }
      if (entries.length>0) await c.from('hrs_report_entries').insert(entries.map(e=>({...e,report_id:reportId})));
      if (sections.length>0) await c.from('hrs_report_sections').insert(sections.map(s=>({...s,report_id:reportId})));

      const isCorr = !!reportOggi;
      const newVersion = reportOggi ? (reportOggi.version||1)+1 : 1;
      const totOre = entries.filter(e=>e.area!=='ASS').reduce((t,e)=>t+calcOre(e.inizio,e.fine,e.pausa),0);
      const numAg = entries.length;

      // Salva revisione cronologia
      try {
        await c.from('hrs_report_revisions').insert({ report_id:reportId, version:newVersion, num_agenti:numAg, total_ore:totOre.toFixed(2) });
      } catch(e) { console.warn('Revision save:', e); }

      const oraInvio = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      await sendTelegram(`${isCorr?`🔄 <b>RAPPORTO CORRETTO</b> (v${newVersion})`:'📋 JAS ha inviato il <b>rapporto</b>'} HRS del ${fmtDateLong(dataOggi)} · ${oraInvio} · ${numAg} ag. · ${totOre.toFixed(2)}h`);
      setInviato(true);
      setReportOggi({ id:reportId, date:dataOggi, submitted_at:reportOggi?.submitted_at||new Date().toISOString(), updated_at:new Date().toISOString(), version:newVersion, status:isCorr?'corrected':'submitted' });
    } catch(e) { console.error(e); alert('Errore durante il salvataggio. Riprova.'); }
    setSalvando(false); setConferma(false);
  };

  const renderSezione = (area) => {
    const agentiSez = agenti.filter(a=>datiAgenti[a.id]?.area===area.id);
    return (
      <div key={area.id} style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:area.light, border:`1px solid ${area.border}`, borderRadius:14, padding:'0.75rem 1rem', marginBottom:6 }}>
          <span style={{ fontWeight:700, color:'#111827' }}>{area.emoji} {area.nome}</span>
          <span style={{ background:area.bg, color:'#fff', borderRadius:99, padding:'2px 10px', fontSize:'0.75rem', fontWeight:700 }}>{agentiSez.length}</span>
        </div>
        {agentiSez.length===0 && <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.78rem', padding:'0.5rem', fontStyle:'italic' }}>Nessun agente assegnato</div>}
        {agentiSez.map(ag => {
          const d = datiAgenti[ag.id]||{};
          return (
            <button key={ag.id} onClick={()=>setModaleAgente(ag.id)}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:area.light, border:`1px solid ${area.border}`, borderRadius:12, padding:'0.8rem 1rem', marginBottom:4, cursor:'pointer' }}>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontWeight:600, color:'#111827', fontSize:'0.9rem' }}>{ag.nome}</div>
                {d.area!=='ASS'&&d.inizio && <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:1 }}>{d.inizio}–{d.fine} · p.{d.pausa ?? 30}'</div>}
                {d.area==='ASS' && <div style={{ fontSize:'0.72rem', color:'#dc2626', marginTop:1 }}>{d.nota||'Assente'}</div>}
                {d.nota&&d.area!=='ASS' && <div style={{ fontSize:'0.7rem', color:'#9ca3af', marginTop:1 }}>📝 {d.nota}</div>}
              </div>
              <span style={{ color:'#9ca3af', fontSize:'1.2rem' }}>›</span>
            </button>
          );
        })}
        <textarea value={osservazioni[area.id]||''} onChange={e=>setOsservazioni(p=>({...p,[area.id]:e.target.value}))}
          placeholder={`Osservazioni ${area.nome}…`} rows={2}
          style={{ width:'100%', border:`1px solid ${area.border}`, borderRadius:12, padding:'0.6rem 0.8rem', fontSize:'0.85rem', resize:'none', background:area.light, boxSizing:'border-box', marginTop:2 }}/>
      </div>
    );
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      {/* Barra progresso */}
      <div style={{ background:'#fff', padding:'0.5rem 1rem', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'#6b7280', marginBottom:4 }}>
          <span><b style={{ color:'#111827' }}>{assegnati}</b>/{agenti.length} assegnati</span>
          {inviato && <span style={{ color:'#16a34a', fontWeight:700 }}>✓ Rapporto inviato</span>}
        </div>
        <div style={{ height:6, background:'#f3f4f6', borderRadius:99 }}>
          <div style={{ height:'100%', background:ORANGE, borderRadius:99, width:`${agenti.length?(assegnati/agenti.length)*100:0}%`, transition:'width 0.3s' }}/>
        </div>
      </div>

      {/* Scroll */}
      <div style={{ flex:1, overflowY:'auto', padding:'1rem', paddingBottom:140 }}>
        {/* Non assegnati */}
        {nonAss.length>0 && (
          <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:16, padding:'0.75rem', marginBottom:'1rem' }}>
            <div style={{ fontWeight:700, color:'#92400e', fontSize:'0.8rem', marginBottom:8 }}>⚠️ Da assegnare ({nonAss.length})</div>
            {nonAss.map(ag => (
              <button key={ag.id} onClick={()=>setModaleAgente(ag.id)}
                style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', border:'1px solid #fde68a', borderRadius:12, padding:'0.85rem 1rem', marginBottom:6, cursor:'pointer' }}>
                <div>
                  <div style={{ fontWeight:600, color:'#111827' }}>{ag.nome}</div>
                  {ag.shift_inizio && <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:1 }}>Piano: {ag.shift_inizio}–{ag.shift_fine}</div>}
                </div>
                <span style={{ color:'#9ca3af', fontSize:'1.2rem' }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Sezioni fisse */}
        {AREE_FISSE.map(a=>renderSezione(a))}

        {/* Lavori Speciali */}
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontWeight:700, color:'#b45309' }}>🔧 Lavori Speciali</span>
            <button onClick={()=>setAddLav(true)} style={{ background:'#fef3c7', color:'#92400e', border:'none', borderRadius:10, padding:'0.4rem 0.8rem', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>+ Aggiungi</button>
          </div>
          {addLav && (
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input autoFocus placeholder="Nome lavorazione…" value={nomeLav} onChange={e=>setNomeLav(e.target.value)}
                style={{ flex:1, border:'2px solid #fcd34d', borderRadius:12, padding:'0.7rem', fontSize:'1rem', background:'#fffbeb' }}/>
              <button onClick={()=>{ if(nomeLav.trim()){setLavorazioni(p=>[...p,{id:Date.now(),nome:nomeLav.trim()}]);setNomeLav('');setAddLav(false);}}}
                style={{ background:'#f59e0b', color:'#fff', border:'none', borderRadius:12, padding:'0.7rem 1rem', fontWeight:700, cursor:'pointer' }}>OK</button>
            </div>
          )}
          {lavorazioni.length===0&&!addLav && <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.78rem', fontStyle:'italic', padding:'0.5rem' }}>Nessuna lavorazione aggiunta</div>}
          {lavorazioni.map(lav=>renderSezione({...LS_BASE, id:`LS_${lav.id}`, nome:lav.nome}))}
        </div>

        {/* Nota generale */}
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>📝 Nota generale</div>
          <textarea value={notaGen} onChange={e=>setNotaGen(e.target.value)}
            placeholder="Note generali sull'impiego (opzionale)…" rows={3}
            style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:14, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#f9fafb', boxSizing:'border-box' }}/>
        </div>

        {/* Aggiungi da PLAN */}
        <button onClick={()=>setPicker(true)}
          style={{ width:'100%', border:'2px dashed #d1d5db', borderRadius:16, padding:'1rem', color:'#6b7280', fontWeight:600, background:'none', cursor:'pointer', marginBottom:'1rem' }}>
          + Aggiungi collaboratore da PLAN
        </button>
      </div>

      {/* Bottone fisso */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'1rem', background:'#fff', borderTop:'1px solid #f3f4f6', boxShadow:'0 -4px 12px rgba(0,0,0,0.08)' }}>
        {inviato ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>apriPdfGenerale(agenti,datiAgenti,osservazioni,lavorazioni,dataOggi)}
                style={{ flex:1, padding:'0.85rem', borderRadius:14, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
                📄 PDF Generale
              </button>
              <button onClick={()=>setShowCondividi(true)}
                style={{ flex:1, padding:'0.85rem', borderRadius:14, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
                📤 Condividi sezione
              </button>
            </div>
            <button onClick={()=>{setInviato(false);setConferma(false);}}
              style={{ width:'100%', padding:'0.85rem', borderRadius:14, border:'none', background:ORANGE_DARK, color:'#fff', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>
              ✏️ Correggi e Reinvia
            </button>
          </div>
        ) : conferma ? (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setConferma(false)} style={{ flex:1, padding:'1rem', borderRadius:16, border:'2px solid #d1d5db', background:'#fff', color:'#374151', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>Annulla</button>
            <button onClick={doInvia} disabled={salvando}
              style={{ flex:1, padding:'1rem', borderRadius:16, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', opacity:salvando?0.7:1 }}>
              {salvando?'Invio…':'✓ Conferma'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {assegnati > 0 && (
              <button onClick={()=>apriPdfGenerale(agenti,datiAgenti,osservazioni,lavorazioni,dataOggi)}
                style={{ width:'100%', padding:'0.85rem', borderRadius:14, border:`2px solid #7c3aed`, background:'transparent', color:'#7c3aed', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>
                👁 Anteprima PDF
              </button>
            )}
            <button onClick={()=>{
              if(nonAss.length>0){alert(`Ci sono ${nonAss.length} agenti non ancora assegnati. Assegnali prima di inviare.`);return;}
              setConferma(true);
            }} style={{ width:'100%', padding:'1.1rem', borderRadius:16, border:'none', background:ORANGE, color:'#fff', fontWeight:800, fontSize:'1.1rem', cursor:'pointer' }}>
              📤 Invia Rapporto
            </button>
          </div>
        )}
      </div>

      {/* Modali */}
      {modaleAgente!==null && agenteAperto && (
        <ModaleAgente agente={agenteAperto} dati={datiAgenti[modaleAgente]||{}}
          onChange={d=>upd(modaleAgente,d)} onChiudi={()=>setModaleAgente(null)} lavorazioni={lavorazioni}/>
      )}
      {picker && (
        <PickerCollaboratori tuttiAgenti={tuttiAgenti} nomiGiaPresenti={agenti.map(a=>a.nome)}
          onScegli={ag=>{setAgenti(p=>[...p,{id:ag.id,nome:ag.name,extra:true}]);setPicker(false);setTimeout(()=>setModaleAgente(ag.id),120);}}
          onChiudi={()=>setPicker(false)}/>
      )}
      {showCondividi && (
        <ModaleCondividi agenti={agenti} datiAgenti={datiAgenti} osservazioni={osservazioni}
          lavorazioni={lavorazioni} dataOggi={dataOggi} onChiudi={()=>setShowCondividi(false)}/>
      )}
    </div>
  );
}

// ── VISTA SETTIMANA ───────────────────────────────────────────────────────────
function VistaSettimana({ shiftsSettimana, agentiDB, reports, ignoredDates, onSelectDate }) {
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const giorni = Array.from({length:7},(_,i)=>{ const d=new Date(oggi);d.setDate(oggi.getDate()+i);return d; });
  const agMap={}; (agentiDB||[]).forEach(a=>{agMap[a.id]=a;});
  const oggiStr=todayIso();
  const ignored = ignoredDates || new Set();
  const passatiSenzaRapporto=[];
  for(let i=1;i<=6;i++){
    const d=new Date(oggi);d.setDate(oggi.getDate()-i);
    const iso=isoDate(d);
    if(!(reports||[]).find(r=>r.date===iso)
       && shiftsSettimana.filter(s=>s.date===iso).length>0
       && !ignored.has(iso))
      passatiSenzaRapporto.unshift({d,iso});
  }
  const renderGiorno=(d,iso,mancante=false)=>{
    const nomi=[...new Set(shiftsSettimana.filter(s=>s.date===iso).map(s=>agMap[s.agent_id]?.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));
    const isToday=iso===oggiStr;
    return(
      <div key={iso} onClick={mancante&&onSelectDate?()=>onSelectDate(iso):undefined}
        style={{background:mancante?'#fef2f2':isToday?'#fff7ed':'#fff',border:`1px solid ${mancante?'#fecaca':isToday?'#fed7aa':'#f3f4f6'}`,borderRadius:16,padding:'0.9rem 1rem',marginBottom:10,cursor:mancante?'pointer':'default'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:nomi.length>0?8:0}}>
          <span style={{fontWeight:700,fontSize:'0.95rem',color:mancante?'#dc2626':isToday?ORANGE_DARK:'#111827'}}>
            {DAY_SHORT[d.getDay()]} {d.getDate()} {MON_SHORT[d.getMonth()]}
            {isToday?' · Oggi':''}{mancante?' · ⚠️ Tocca per compilare':''}
          </span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{background:nomi.length>0?(mancante?'#fef2f2':'#fff7ed'):'#f3f4f6',color:nomi.length>0?(mancante?'#dc2626':ORANGE_DARK):'#9ca3af',borderRadius:99,padding:'3px 12px',fontSize:'0.78rem',fontWeight:700}}>{nomi.length} ag.</span>
            {mancante&&<span style={{color:'#dc2626'}}>›</span>}
          </div>
        </div>
        {nomi.length>0?(
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{nomi.map(n=><span key={n} style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'2px 8px',fontSize:'0.7rem',color:'#374151'}}>{n}</span>)}</div>
        ):<div style={{fontSize:'0.78rem',color:'#9ca3af',fontStyle:'italic'}}>Nessun agente pianificato</div>}
      </div>
    );
  };
  return(
    <div style={{flex:1,overflowY:'auto',padding:'1rem'}}>
      <div style={{textAlign:'center',color:'#9ca3af',fontSize:'0.78rem',marginBottom:'1rem',fontWeight:500}}>Pianificazione · Sola lettura</div>
      {passatiSenzaRapporto.length>0&&(
        <div style={{marginBottom:'0.5rem'}}>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'#dc2626',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>⚠️ Rapporti mancanti — tocca per compilare</div>
          {passatiSenzaRapporto.map(({d,iso})=>renderGiorno(d,iso,true))}
        </div>
      )}
      {giorni.map(d=>renderGiorno(d,isoDate(d),false))}
    </div>
  );
}

// ── MODALE DETTAGLIO ARCHIVIO ─────────────────────────────────────────────────
function ModaleDettaglioArchivio({ report, onChiudi, onModifica }) {
  const [entries,setEntries]=useState([]);
  const [sezioni,setSezioni]=useState([]);
  const [lavRpt,setLavRpt]=useState([]);
  const [revisions,setRevisions]=useState([]);
  const [showCron,setShowCron]=useState(false);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    try{
      const c=await sb();
      const{data:en}=await c.from('hrs_report_entries').select('*').eq('report_id',report.id);
      const{data:se}=await c.from('hrs_report_sections').select('*').eq('report_id',report.id);
      const{data:rv}=await c.from('hrs_report_revisions').select('*').eq('report_id',report.id).order('version',{ascending:true});
      setEntries(en||[]); setSezioni(se||[]); setRevisions(rv||[]);
      const lavNomi=[...new Set((en||[]).filter(e=>e.area?.startsWith('LS_')).map(e=>e.lavorazione_nome).filter(Boolean))];
      setLavRpt(lavNomi.map((nome,i)=>({id:`a${i}`,nome})));
    }catch(e){console.error(e);}
    setLoading(false);
  })();},[report.id]);
  const oT=t=>t?new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';
  const aree=[...AREE_FISSE,...lavRpt.map(l=>({...LS_BASE,id:`LS_a${l.id}`,nome:l.nome}))];
  const agentiRpt=entries.map(e=>({id:e.agent_id||`x_${e.id}`,nome:e.agent_name}));
  const datiRpt={};entries.forEach(e=>{datiRpt[e.agent_id||`x_${e.id}`]={area:e.area,inizio:e.inizio,fine:e.fine,pausa:e.pausa,nota:e.nota};});
  const ossRpt={};sezioni.forEach(s=>{ossRpt[s.area]=s.osservazione;});

  // Verifica se modificabile (entro 7 giorni)
  const oggi=new Date();oggi.setHours(0,0,0,0);
  const dataRpt=new Date(report.date+'T12:00:00');
  const giorniDiff=Math.round((oggi-dataRpt)/86400000);
  const modificabile = onModifica && giorniDiff>=0 && giorniDiff<=7;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div style={{background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 1.25rem 0.75rem',borderBottom:'1px solid #f3f4f6',flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,color:'#111827'}}>{fmtDateLong(report.date)}</div>
            <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:2}}>
              Inviato {oT(report.submitted_at)}
              {report.version>1 && report.updated_at && ` · Modificato ${oT(report.updated_at)}`}
              {report.version>1 && ` · v${report.version}`}
              {revisions.length>1 && (
                <button onClick={()=>setShowCron(!showCron)} style={{background:'none',border:'none',color:ORANGE_DARK,fontSize:'0.72rem',fontWeight:700,cursor:'pointer',padding:'0 0 0 6px'}}>
                  {showCron?'▴ nascondi':'▾ cronologia'}
                </button>
              )}
            </div>
            {showCron && revisions.length>0 && (
              <div style={{marginTop:6,padding:'8px 10px',background:'#fff7ed',border:`1px solid #fed7aa`,borderRadius:8,fontSize:'0.72rem',color:'#374151'}}>
                {revisions.map(rv=>(
                  <div key={rv.id} style={{padding:'2px 0',display:'flex',justifyContent:'space-between',gap:8}}>
                    <span><b>v{rv.version}</b> · {new Date(rv.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                    <span style={{color:'#9ca3af'}}>{rv.num_agenti?`${rv.num_agenti} ag.`:''}{rv.total_ore?` · ${parseFloat(rv.total_ore).toFixed(2)}h`:''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onChiudi} style={{width:36,height:36,borderRadius:'50%',background:'#f3f4f6',border:'none',fontSize:'1.3rem',cursor:'pointer',fontWeight:700,flexShrink:0,marginLeft:8}}>×</button>
        </div>
        <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #f3f4f6',display:'flex',gap:8,flexShrink:0}}>
          {modificabile && (
            <button onClick={()=>{onModifica(report.date);onChiudi();}}
              style={{flex:1,padding:'0.7rem',borderRadius:12,border:'none',background:ORANGE,color:'#fff',fontWeight:700,fontSize:'0.8rem',cursor:'pointer'}}>
              ✏️ Modifica
            </button>
          )}
          <button onClick={()=>apriPdfGenerale(agentiRpt,datiRpt,ossRpt,lavRpt,report.date)}
            style={{flex:1,padding:'0.7rem',borderRadius:12,border:'none',background:'#7c3aed',color:'#fff',fontWeight:700,fontSize:'0.8rem',cursor:'pointer'}}>
            📄 PDF Generale
          </button>
          <button onClick={()=>{
            const ids=aree.filter(a=>{const s=entries.filter(e=>e.area===a.id);return s.length>0;});
            if(ids.length===0)return;
            const labels=ids.map(a=>a.label).join(' / ');
            const scelta=prompt(`Quale sezione? (${labels})`);
            if(!scelta)return;
            const area=aree.find(a=>a.label===scelta.toUpperCase()||a.id===scelta||a.nome.toLowerCase()===scelta.toLowerCase());
            if(!area)return;
            const agSez=agentiRpt.filter(a=>datiRpt[a.id]?.area===area.id);
            apriPdfRapporto(area,agSez.map(a=>({nome:a.nome,...datiRpt[a.id]})),ossRpt[area.id]||'',report.date);
          }} style={{flex:1,padding:'0.7rem',borderRadius:12,border:'none',background:'#16a34a',color:'#fff',fontWeight:700,fontSize:'0.8rem',cursor:'pointer'}}>
            📤 PDF Sezione
          </button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'0.75rem 1rem 2rem'}}>
          {loading?(<div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div style={{width:36,height:36,border:`3px solid ${ORANGE}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>):(
            aree.map(area=>{
              const agSez=entries.filter(e=>e.area===area.id);
              if(agSez.length===0)return null;
              const oss=ossRpt[area.id]||'';
              return(
                <div key={area.id} style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',background:area.light,border:`1px solid ${area.border}`,borderRadius:12,padding:'0.6rem 0.9rem',marginBottom:6}}>
                    <span style={{fontWeight:700,fontSize:'0.88rem'}}>{area.emoji} {area.nome}</span>
                    <span style={{background:area.bg,color:'#fff',borderRadius:99,padding:'1px 8px',fontSize:'0.72rem',fontWeight:700}}>{agSez.length}</span>
                  </div>
                  {agSez.map((e,i)=>(
                    <div key={i} style={{background:area.light,border:`1px solid ${area.border}`,borderRadius:10,padding:'0.65rem 0.9rem',marginBottom:3}}>
                      <div style={{fontWeight:600,fontSize:'0.88rem',color:'#111827'}}>{e.agent_name}</div>
                      {e.area!=='ASS'&&e.inizio&&<div style={{fontSize:'0.72rem',color:'#6b7280',marginTop:1}}>{fmtTime(e.inizio)}–{fmtTime(e.fine)} · p.{e.pausa ?? 30}' · <b>{calcOre(e.inizio,e.fine,e.pausa).toFixed(2)}h</b></div>}
                      {e.area==='ASS'&&<div style={{fontSize:'0.72rem',color:'#dc2626',marginTop:1}}>⛔ {e.nota||'Assente'}</div>}
                      {e.nota&&e.area!=='ASS'&&<div style={{fontSize:'0.7rem',color:'#9ca3af',marginTop:1}}>📝 {e.nota}</div>}
                    </div>
                  ))}
                  {oss&&<div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'0.5rem 0.75rem',marginTop:4,fontSize:'0.78rem',color:'#374151'}}>📝 {oss}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── VISTA ARCHIVIO ────────────────────────────────────────────────────────────
function VistaArchivio({ reports, onSelectDate }) {
  const [reportSel,setReportSel]=useState(null);
  const byMese={};
  reports.forEach(r=>{
    const d=new Date(r.date+'T12:00:00');
    const key=`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
    const label=`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if(!byMese[key])byMese[key]={label,items:[]};
    byMese[key].items.push(r);
  });
  const mesi=Object.entries(byMese).sort((a,b)=>b[0].localeCompare(a[0])).map(([,v])=>v);
  const oT=t=>t?new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';
  return(
    <div style={{flex:1,overflowY:'auto',padding:'1rem'}}>
      {mesi.length===0&&<div style={{textAlign:'center',color:'#9ca3af',padding:'3rem',fontSize:'0.9rem'}}>Nessun rapporto in archivio</div>}
      {mesi.map(m=>(
        <div key={m.label}>
          <div style={{fontWeight:700,color:'#6b7280',fontSize:'0.72rem',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8,marginTop:8}}>{m.label}</div>
          {m.items.map(r=>(
            <button key={r.id} onClick={()=>setReportSel(r)}
              style={{width:'100%',textAlign:'left',background:'#fff',border:'1px solid #f3f4f6',borderRadius:16,padding:'1rem',marginBottom:8,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,color:'#111827'}}>{fmtDateLong(r.date)}</div>
                <div style={{fontSize:'0.78rem',color:'#9ca3af',marginTop:2}}>{r.submitted_at?`Inviato ${oT(r.submitted_at)}`:''}{r.version>1?` · v${r.version}`:''}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{background:r.status==='corrected'?'#ffedd5':'#f0fdf4',color:r.status==='corrected'?'#ea580c':'#16a34a',borderRadius:99,padding:'4px 10px',fontSize:'0.78rem',fontWeight:700}}>{r.status==='corrected'?'✏️':'✓'}</span>
                <span style={{color:'#9ca3af'}}>›</span>
              </div>
            </button>
          ))}
        </div>
      ))}
      {reportSel&&<ModaleDettaglioArchivio report={reportSel} onChiudi={()=>setReportSel(null)} onModifica={onSelectDate}/>}
    </div>
  );
}


// ── ADMIN SETTIMANA VIEW ──────────────────────────────────────────────────────
function AdminSettimanaView({ shiftsSettimana, agentiDB, reports, ignoredDates, setIgnoredDates }) {
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const giorni = Array.from({length:7},(_,i)=>{ const d=new Date(oggi);d.setDate(oggi.getDate()+i);return d; });
  const agMap={}; (agentiDB||[]).forEach(a=>{agMap[a.id]=a;});
  const oggiStr = todayIso();
  const ignored = ignoredDates || new Set();

  const ignoraGiorno = async (iso) => {
    if(!window.confirm(`Eliminare il giorno ${fmtDateLong(iso)}?\n\nNon apparirà più tra i rapporti mancanti né nell'app di JAS.`)) return;
    try {
      const c = await sb();
      const { error } = await c.from('hrs_ignored_dates').upsert({ date: iso });
      if(error) throw error;
      setIgnoredDates(prev => new Set([...prev, iso]));
    } catch(e){
      console.error(e);
      window.alert('Errore durante l\'eliminazione: ' + (e.message||e));
    }
  };

  // Giorni passati senza rapporto (escluse date ignorate)
  const passatiMancanti=[];
  for(let i=1;i<=6;i++){
    const d=new Date(oggi);d.setDate(oggi.getDate()-i);
    const iso=isoDate(d);
    if(!(reports||[]).find(r=>r.date===iso)
       && shiftsSettimana.filter(s=>s.date===iso).length>0
       && !ignored.has(iso))
      passatiMancanti.unshift({d,iso});
  }

  const renderGiorno=(d,iso,mostraElimina=false)=>{
    const shiftsG=shiftsSettimana.filter(s=>s.date===iso);
    const pianificati=[...new Set(shiftsG.map(s=>agMap[s.agent_id]?.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));
    const report=(reports||[]).find(r=>r.date===iso)||null;
    const isToday=iso===oggiStr;
    const mancante=!report&&iso<oggiStr&&pianificati.length>0;

    return(
      <div key={iso} style={{ background:mancante?'#fef2f2':isToday?'#fff7ed':'#fff', border:`1px solid ${mancante?'#fecaca':isToday?'#fed7aa':'#f3f4f6'}`, borderRadius:16, padding:'0.9rem 1rem', marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontWeight:800, fontSize:'0.95rem', color:mancante?'#dc2626':isToday?ORANGE_DARK:'#111827' }}>
            {DAY_SHORT[d.getDay()]} {d.getDate()} {MON_SHORT[d.getMonth()]}
            {isToday?' · Oggi':''}
          </span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {report
              ? <span style={{ background:'#f0fdf4', color:'#16a34a', borderRadius:99, padding:'2px 10px', fontSize:'0.72rem', fontWeight:700 }}>✓ Ricevuto</span>
              : iso<=oggiStr&&pianificati.length>0
                ? <span style={{ background:'#fef2f2', color:'#dc2626', borderRadius:99, padding:'2px 10px', fontSize:'0.72rem', fontWeight:700 }}>⚠ Mancante</span>
                : <span style={{ background:'#f3f4f6', color:'#9ca3af', borderRadius:99, padding:'2px 10px', fontSize:'0.72rem', fontWeight:700 }}>In attesa</span>
            }
            {mostraElimina && (
              <button onClick={(ev)=>{ev.stopPropagation();ignoraGiorno(iso);}} title="Rimuovi dalla lista"
                style={{ background:'#fff', border:'1px solid #fecaca', borderRadius:8, width:28, height:28, cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                🗑️
              </button>
            )}
          </div>
        </div>

        {pianificati.length>0 ? (
          <div>
            <div style={{ fontSize:'0.68rem', color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
              Pianificati ({pianificati.length})
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {pianificati.map(n=>(
                <span key={n} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'2px 8px', fontSize:'0.7rem', color:'#374151' }}>{n}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize:'0.78rem', color:'#9ca3af', fontStyle:'italic' }}>Nessun agente pianificato</div>
        )}

        {/* Riepilogo rapporto se disponibile */}
        {report && (
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:'0.68rem', color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
              Rapporto · {new Date(report.submitted_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
              {report.version>1&&<span style={{ color:'#ea580c', marginLeft:6 }}>v{report.version}</span>}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {AREE_FISSE.filter(a=>a.id!=='ASS').map(area=>(
                <span key={area.id} style={{ background:area.light, border:`1px solid ${area.border}`, borderRadius:8, padding:'2px 8px', fontSize:'0.7rem', color:'#374151', fontWeight:600 }}>
                  {area.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return(
    <div style={{ flex:1, overflowY:'auto', padding:'1rem' }}>
      <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.75rem', marginBottom:'1rem', fontWeight:500 }}>
        Pianificato vs Ricevuto · Solo lettura
      </div>
      {passatiMancanti.length>0&&(
        <div style={{ marginBottom:'0.75rem' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>⚠️ Rapporti mancanti</div>
          {passatiMancanti.map(({d,iso})=>renderGiorno(d,iso,true))}
        </div>
      )}
      {giorni.map(d=>renderGiorno(d,isoDate(d)))}
    </div>
  );
}

// ── VISTA ADMIN ───────────────────────────────────────────────────────────────
function VistaAdmin({ reports, agentiDB, shiftsSettimana, ignoredDates, setIgnoredDates }) {
  const [tab, setTab] = useState('oggi');
  const [reportSel, setReportSel] = useState(null);
  const [entries, setEntries] = useState([]);
  const [sezioni, setSezioni] = useState([]);
  const [loadingRpt, setLoadingRpt] = useState(false);
  const [showCondividi, setShowCondividi] = useState(false);

  const DATA_OGGI = todayIso();
  const rOggi = reports.find(r => r.date === DATA_OGGI) || null;

  const caricaReport = async (r) => {
    setLoadingRpt(true);
    try {
      const c = await sb();
      const { data: en } = await c.from('hrs_report_entries').select('*').eq('report_id', r.id);
      const { data: se } = await c.from('hrs_report_sections').select('*').eq('report_id', r.id);
      setEntries(en || []);
      setSezioni(se || []);
      setReportSel(r);
    } catch(e) { console.error(e); }
    setLoadingRpt(false);
  };

  useEffect(() => { if (rOggi && tab === 'oggi') caricaReport(rOggi); }, [rOggi?.id, tab]);

  const oT = t => t ? new Date(t).toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}) : '';

  const renderRapporto = (r, en, se) => {
    if (!r) return <div style={{ textAlign:'center', color:'#9ca3af', padding:'3rem', fontSize:'0.9rem' }}>Nessun rapporto inviato oggi</div>;
    const aree = [...AREE_FISSE, ...se.filter(s=>s.area.startsWith('LS_')).map(s=>({...LS_BASE, id:s.area, nome:s.lavorazione_nome||s.area}))];
    const totOreGiornata = en.filter(e=>e.area!=='ASS').reduce((t,e)=>t+calcOre(e.inizio,e.fine,e.pausa),0);
    return (
      <div style={{ padding:'1rem', paddingBottom:120 }}>
        {/* Header rapporto */}
        <div style={{ background:'#fff', border:'1px solid #f3f4f6', borderRadius:16, padding:'1rem', marginBottom:'1rem' }}>
          <div style={{ fontWeight:800, color:'#111827', marginBottom:4 }}>{fmtDateLong(r.date)}</div>
          <div style={{ fontSize:'0.78rem', color:'#9ca3af' }}>
            Inviato {oT(r.submitted_at)} · {en.length} agenti · v{r.version||1}
            {r.status==='corrected' && <span style={{ color:'#ea580c', marginLeft:6 }}>· Corretto</span>}
          </div>
          <div style={{ marginTop:8, padding:'6px 10px', background:'#fff7ed', borderRadius:10, display:'inline-block' }}>
            <span style={{ fontSize:'0.8rem', fontWeight:700, color:ORANGE_DARK }}>Totale ore giornata: {totOreGiornata.toFixed(2)}h</span>
          </div>
        </div>

        {/* Sezioni */}
        {aree.map(area => {
          const agentiSez = en.filter(e=>e.area===area.id);
          if (agentiSez.length===0) return null;
          const ossSezione = se.find(s=>s.area===area.id)?.osservazione||'';
          const totSez = agentiSez.filter(e=>e.area!=='ASS').reduce((t,e)=>t+calcOre(e.inizio,e.fine,e.pausa),0);
          return (
            <div key={area.id} style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:area.light, border:`1px solid ${area.border}`, borderRadius:14, padding:'0.75rem 1rem', marginBottom:6 }}>
                <span style={{ fontWeight:700, color:'#111827' }}>{area.emoji} {area.nome}</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280' }}>{totSez.toFixed(1)}h tot.</span>
                  <span style={{ background:area.bg, color:'#fff', borderRadius:99, padding:'2px 10px', fontSize:'0.75rem', fontWeight:700 }}>{agentiSez.length}</span>
                </div>
              </div>
              {agentiSez.map((e,i) => (
                <div key={i} style={{ background:area.light, border:`1px solid ${area.border}`, borderRadius:12, padding:'0.75rem 1rem', marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'#111827', fontSize:'0.9rem' }}>{e.agent_name}{e.is_extra&&<span style={{ fontSize:'0.65rem', color:'#ea580c', marginLeft:6 }}>+aggiunto</span>}</div>
                      {e.area!=='ASS' && e.inizio && <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:1 }}>{fmtTime(e.inizio)}–{fmtTime(e.fine)} · p.{e.pausa ?? 30}' · <b>{calcOre(e.inizio,e.fine,e.pausa).toFixed(2)}h</b></div>}
                      {e.area==='ASS' && <div style={{ fontSize:'0.72rem', color:'#dc2626', marginTop:1 }}>⛔ {e.nota||'Assente'}</div>}
                      {e.nota&&e.area!=='ASS' && <div style={{ fontSize:'0.7rem', color:'#9ca3af', marginTop:1 }}>📝 {e.nota}</div>}
                      {e.shift_inizio && <div style={{ fontSize:'0.65rem', color:'#d1d5db', marginTop:1 }}>Piano: {e.shift_inizio}–{e.shift_fine}</div>}
                    </div>
                  </div>
                </div>
              ))}
              {ossSezione && (
                <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'0.6rem 0.8rem', marginTop:4 }}>
                  <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:3 }}>Osservazioni</div>
                  <div style={{ fontSize:'0.82rem', color:'#374151' }}>{ossSezione}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Nota generale */}
        {r.nota_generale && (
          <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:14, padding:'0.75rem 1rem', marginBottom:'1rem' }}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:4 }}>📝 Nota generale</div>
            <div style={{ fontSize:'0.85rem', color:'#374151' }}>{r.nota_generale}</div>
          </div>
        )}
      </div>
    );
  };

  // Riepilogo ore per area del mese corrente
  const renderRiepilogo = () => {
    const ora = new Date();
    const meseStr = `${ora.getFullYear()}-${String(ora.getMonth()+1).padStart(2,'0')}`;
    const rptMese = reports.filter(r=>r.date.startsWith(meseStr));
    // Per ora mostriamo solo conteggio rapporti — le ore aggregate richiedono carico entries
    return (
      <div style={{ padding:'1rem' }}>
        <div style={{ fontWeight:700, color:'#111827', marginBottom:'1rem' }}>{MONTH_NAMES[ora.getMonth()]} {ora.getFullYear()}</div>
        <div style={{ background:'#fff', border:'1px solid #f3f4f6', borderRadius:16, padding:'1rem', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'0.85rem', color:'#6b7280' }}>Rapporti inviati</div>
          <div style={{ fontWeight:800, fontSize:'1.5rem', color:ORANGE }}>{rptMese.length}</div>
        </div>
        <div style={{ fontSize:'0.75rem', color:'#9ca3af', textAlign:'center', fontStyle:'italic' }}>Il riepilogo ore per area è disponibile nel tab HRS di PLAN</div>
        <div style={{ marginTop:'1.5rem', fontWeight:700, color:'#6b7280', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Ultimi rapporti</div>
        {reports.slice(0,10).map(r=>(
          <button key={r.id} onClick={()=>{ caricaReport(r); setTab('oggi'); }}
            style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', border:'1px solid #f3f4f6', borderRadius:14, padding:'0.85rem 1rem', marginBottom:8, cursor:'pointer' }}>
            <div>
              <div style={{ fontWeight:700, color:'#111827', fontSize:'0.9rem' }}>{fmtDateLong(r.date)}</div>
              <div style={{ fontSize:'0.75rem', color:'#9ca3af', marginTop:1 }}>v{r.version||1} · {oT(r.submitted_at)}</div>
            </div>
            <span style={{ background:r.status==='corrected'?'#ffedd5':'#f0fdf4', color:r.status==='corrected'?'#ea580c':'#16a34a', borderRadius:99, padding:'3px 10px', fontSize:'0.75rem', fontWeight:700 }}>
              {r.status==='corrected'?'✏️':'✓'}
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Sub-tab admin */}
      <div style={{ display:'flex', gap:1, background:'#f3f4f6', padding:4, margin:'8px 12px', borderRadius:14, flexShrink:0 }}>
        {[{id:'oggi',l:'📋 Oggi'},{id:'settimana',l:'📅 Settimana'},{id:'archivio',l:'🗂 Archivio'},{id:'riepilogo',l:'📊 Riepilogo'}].map(t=>(
          <button key={t.id} onClick={()=>{ setTab(t.id); if(t.id==='oggi'&&rOggi)caricaReport(rOggi); }}
            style={{ flex:1, padding:'0.6rem 0', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
              background:tab===t.id?'#fff':'transparent', color:tab===t.id?ORANGE_DARK:'#6b7280' }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {tab==='oggi' && (
          loadingRpt
            ? <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div style={{ width:36,height:36,border:`3px solid ${ORANGE}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/></div>
            : reportSel
              ? renderRapporto(reportSel, entries, sezioni)
              : renderRapporto(null, [], [])
        )}
        {tab==='settimana' && <AdminSettimanaView shiftsSettimana={shiftsSettimana} agentiDB={agentiDB} reports={reports} ignoredDates={ignoredDates} setIgnoredDates={setIgnoredDates}/>}
        {tab==='archivio' && <VistaArchivio reports={reports}/>}
        {tab==='riepilogo' && renderRiepilogo()}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [logged, setLogged] = useState(false);
  const [ruolo, setRuolo] = useState(null);
  const [tab, setTab] = useState('oggi');
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const [dataTarget, setDataTarget] = useState(todayIso()); // data compilazione attiva
  const [agentiOggi, setAgentiOggi]   = useState([]);
  const [tuttiAgenti, setTuttiAgenti] = useState([]);
  const [agentiDB, setAgentiDB]       = useState([]);
  const [shiftsSettimana, setShiftsSettimana] = useState([]);
  const [reports, setReports]         = useState([]);
  const [reportOggi, setReportOggi]   = useState(null);
  const [reportIeri, setReportIeri]   = useState(null);
  const [hrsSvcIds, setHrsSvcIds]     = useState([]);
  const [agMap, setAgMap]             = useState({});
  const [ignoredDates, setIgnoredDates] = useState(new Set());
  const [refreshing, setRefreshing]   = useState(false);

  const [datiAgenti, setDatiAgenti]   = useState({});
  const [osservazioni, setOsservazioni] = useState({});
  const [lavorazioni, setLavorazioni] = useState([]);
  const [inviato, setInviato]         = useState(false);

  const DATA_OGGI = todayIso();
  const DATA_IERI = yesterdayIso();

  // Carica i dati per una data specifica (oggi o giorno passato)
  const caricaDataTarget = useCallback(async (date, svcIds, agMapRef) => {
    setLoadingData(true);
    try {
      const c = await sb();
      const { data:sData } = await c.from('shifts').select('*').eq('date',date).in('service_id',svcIds);
      const seen=new Set();
      const agGiorno=(sData||[]).map(s=>{
        const ag=agMapRef[s.agent_id];
        if(!ag||seen.has(ag.id))return null;
        seen.add(ag.id);
        return{id:ag.id,nome:ag.name,shift_inizio:s.start_time?s.start_time.slice(0,5):null,shift_fine:s.end_time?s.end_time.slice(0,5):null,extra:false};
      }).filter(Boolean).sort((a,b)=>a.nome.localeCompare(b.nome,'it'));

      setAgentiOggi(agGiorno);
      setDataTarget(date);
      setLavorazioni([]);
      setOsservazioni({});

      const { data:rpts2 } = await c.from('hrs_reports').select('*').order('date',{ascending:false}).limit(90);
      setReports(rpts2||[]);
      const rData = (rpts2||[]).find(r=>r.date===date)||null;
      setReportOggi(rData);
      setReportIeri((rpts2||[]).find(r=>r.date===DATA_IERI)||null);

      if (!rData) {
        const dIniz={};
        agGiorno.forEach(ag=>{dIniz[ag.id]={inizio:ag.shift_inizio||'07:00',fine:ag.shift_fine||'17:00',pausa:'30'};});
        setDatiAgenti(dIniz); setInviato(false);
      } else {
        setInviato(true);
        const{data:entries}=await c.from('hrs_report_entries').select('*').eq('report_id',rData.id);
        const{data:sezioni}=await c.from('hrs_report_sections').select('*').eq('report_id',rData.id);
        const nuoviDati={}; const nuoviAgenti=[...agGiorno];
        (entries||[]).forEach(e=>{
          if(e.agent_id){nuoviDati[e.agent_id]={area:e.area,inizio:e.inizio,fine:e.fine,pausa:String(e.pausa ?? 30),nota:e.nota||''};}
          else{const xid=`extra_${e.id}`;nuoviAgenti.push({id:xid,nome:e.agent_name,extra:true});nuoviDati[xid]={area:e.area,inizio:e.inizio,fine:e.fine,pausa:String(e.pausa ?? 30),nota:e.nota||''};}
        });
        setAgentiOggi(nuoviAgenti); setDatiAgenti(nuoviDati);
        const nuoveOss={}; (sezioni||[]).forEach(s=>{nuoveOss[s.area]=s.osservazione;}); setOsservazioni(nuoveOss);
      }
    } catch(e){console.error(e);}
    setLoadingData(false);
  }, [DATA_IERI]);

  const loadData = useCallback(async () => {
    if (!logged) return;
    setLoading(true);
    try {
      const c = await sb();
      const { data:hrsServices } = await c.from('services').select('id,name').ilike('name', '%HRS%Stadio%');
      const svcIds = (hrsServices||[]).map(s=>s.id);
      setHrsSvcIds(svcIds);
      console.log('Servizi HRS trovati:', (hrsServices||[]).map(s=>s.name));

      const { data:agenti } = await c.from('agents').select('id,name').order('name');
      setTuttiAgenti(agenti||[]);
      setAgentiDB(agenti||[]);
      const aMap={}; (agenti||[]).forEach(a=>{aMap[a.id]=a;});
      setAgMap(aMap);

      if (svcIds.length>0) {
        const oggi=new Date(); oggi.setHours(0,0,0,0);
        const fine7=new Date(oggi); fine7.setDate(oggi.getDate()+6);
        const inizio6fa=new Date(oggi); inizio6fa.setDate(oggi.getDate()-6);
        const{data:sWeek}=await c.from('shifts').select('*').gte('date',isoDate(inizio6fa)).lte('date',isoDate(fine7)).in('service_id',svcIds);
        setShiftsSettimana(sWeek||[]);

        // Carica date ignorate (giorni esclusi dalla lista rapporti mancanti)
        const { data:ignored } = await c.from('hrs_ignored_dates').select('date');
        setIgnoredDates(new Set((ignored||[]).map(r=>r.date)));

        await caricaDataTarget(DATA_OGGI, svcIds, aMap);
      }
    } catch(e){console.error('Load error:',e);}
    setLoading(false);
  }, [logged, DATA_OGGI, caricaDataTarget]);

  useEffect(()=>{ loadData(); },[loadData]);

  const handleSelectDate = useCallback(async (iso) => {
    setTab('oggi');
    await caricaDataTarget(iso, hrsSvcIds, agMap);
  }, [hrsSvcIds, agMap, caricaDataTarget]);

  const tornaAdOggi = useCallback(async () => {
    await caricaDataTarget(DATA_OGGI, hrsSvcIds, agMap);
  }, [DATA_OGGI, hrsSvcIds, agMap, caricaDataTarget]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } catch(e) { console.error('Refresh error:', e); }
    setRefreshing(false);
  }, [refreshing, loadData]);

  if (!logged) return <LoginScreen onLogin={r=>{setLogged(true);setRuolo(r);}}/>;

  const isPassato = dataTarget !== DATA_OGGI;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#f9fafb', maxWidth:520, margin:'0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <div style={{ background:ORANGE, color:'#fff', padding:'2.5rem 1rem 0.75rem', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
          <div>
            <div style={{ fontWeight:900, fontSize:'1.5rem', letterSpacing:'0.08em' }}>HRS STADIO</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
              <div style={{ fontSize:'0.78rem', opacity:0.85 }}>{fmtDateLong(dataTarget)}</div>
              {isPassato && (
                <button onClick={tornaAdOggi}
                  style={{ fontSize:'0.68rem', background:'rgba(255,255,255,0.25)', border:'none', borderRadius:8, padding:'2px 8px', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                  ← Oggi
                </button>
              )}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={handleRefresh} disabled={refreshing} title="Aggiorna"
              style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', color:'#fff', cursor:refreshing?'wait':'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
              <span style={{ display:'inline-block', animation:refreshing?'spin 0.8s linear infinite':'none' }}>🔄</span>
            </button>
            <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'0.8rem' }}>
              {ruolo==='admin'?'ADM':'JAS'}
            </div>
          </div>
        </div>
        {ruolo==='jas' && (
        <div style={{ display:'flex', background:'rgba(0,0,0,0.18)', borderRadius:16, padding:4, gap:4 }}>
          {[{id:'oggi',l:'📋 Oggi'},{id:'settimana',l:'📅 Sett.'},{id:'archivio',l:'🗂 Archivio'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'0.6rem 0', borderRadius:12, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.8rem',
                background:tab===t.id?'#fff':'transparent', color:tab===t.id?ORANGE_DARK:'rgba(255,255,255,0.85)' }}>
              {t.l}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* STATUS BANNER */}
      <StatusBanner reportOggi={reports.find(r=>r.date===DATA_OGGI)||null} reportIeri={reportIeri}/>

      {/* CONTENUTO */}
      {loading ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
          <div style={{ width:44, height:44, border:`4px solid ${ORANGE}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <div style={{ color:'#9ca3af', fontSize:'0.9rem' }}>Caricamento…</div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {ruolo==='admin' ? (
            <VistaAdmin reports={reports} agentiDB={agentiDB} shiftsSettimana={shiftsSettimana} ignoredDates={ignoredDates} setIgnoredDates={setIgnoredDates}/>
          ) : (
            <>
              {tab==='oggi' && (
                loadingData ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:36, height:36, border:`3px solid ${ORANGE}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  </div>
                ) : (
                  <VistaOggi agenti={agentiOggi} setAgenti={setAgentiOggi}
                    datiAgenti={datiAgenti} setDatiAgenti={setDatiAgenti}
                    osservazioni={osservazioni} setOsservazioni={setOsservazioni}
                    lavorazioni={lavorazioni} setLavorazioni={setLavorazioni}
                    tuttiAgenti={tuttiAgenti} inviato={inviato} setInviato={setInviato}
                    reportOggi={reportOggi} setReportOggi={setReportOggi} dataOggi={dataTarget}/>
                )
              )}
              {tab==='settimana' && <VistaSettimana shiftsSettimana={shiftsSettimana} agentiDB={agentiDB} reports={reports} ignoredDates={ignoredDates} onSelectDate={handleSelectDate}/>}
              {tab==='archivio' && <VistaArchivio reports={reports} onSelectDate={handleSelectDate}/>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
