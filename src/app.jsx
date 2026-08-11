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
const CHANGELOG_LS_KEY = "deltagroup-hrs-changelog-read-ids";
const HRS_PREFIX = "HRS - Stadio";
const ORANGE = "#f97316";
const ORANGE_DARK = "#ea580c";
const APP_VERSION = "v1.5";

import { useState, useEffect, useCallback, useRef } from "react";

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
// Restituisce sempre un array di segmenti da `dati` di un collaboratore.
// Supporta il formato vecchio (area/inizio/fine/pausa a livello top) e il nuovo (segmenti: [...]).
const getSegmenti = d => {
  if (!d) return [];
  if (Array.isArray(d.segmenti) && d.segmenti.length > 0) return d.segmenti;
  if (d.area) return [{area:d.area, inizio:d.inizio, fine:d.fine, pausa:d.pausa}];
  return [];
};
const oreTotDati = d => getSegmenti(d).filter(s=>s.area!=='ASS').reduce((t,s)=>t+calcOre(s.inizio,s.fine,s.pausa),0);
const getMonday = () => { const d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); d.setDate(diff);d.setHours(0,0,0,0);return d; };
const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAY_SHORT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MON_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// ── AREE ──────────────────────────────────────────────────────────────────────
// Aree "vive" — selezionabili per NUOVI rapporti.
const AREE_FISSE = [
  { id:'T2', label:'T2', nome:'Tappa 2',           emoji:'🏁', bg:'#db2777', light:'#fdf2f8', border:'#fbcfe8' },
  { id:'T3', label:'T3', nome:'Tappa 3',           emoji:'🚩', bg:'#4f46e5', light:'#eef2ff', border:'#c7d2fe' },
  { id:'AS', label:'AS', nome:'Arena Sportiva',   emoji:'🏟️', bg:'#2563eb', light:'#eff6ff', border:'#bfdbfe' },
  { id:'PS', label:'PS', nome:'Palazzetto Sport',  emoji:'🏀', bg:'#16a34a', light:'#f0fdf4', border:'#bbf7d0' },
  { id:'FB', label:'FB', nome:'Fenceboxes',        emoji:'🚧', bg:'#7c3aed', light:'#f5f3ff', border:'#ddd6fe' },
  { id:'LO', label:'LO', nome:'Logistica',         emoji:'📦', bg:'#0891b2', light:'#ecfeff', border:'#a5f3fc' },
  { id:'ASS',label:'⛔', nome:'Assente',            emoji:'⛔', bg:'#dc2626', light:'#fef2f2', border:'#fecaca' },
];
// Aree "storiche" (deprecate) — NON selezionabili, ma servono per visualizzare rapporti passati.
const AREE_LEGACY = [
  { id:'GF', label:'GF', nome:'Glassfloor',        emoji:'🪟', bg:'#94a3b8', light:'#f1f5f9', border:'#cbd5e1', legacy:true },
];
const AREE_TUTTE = [...AREE_FISSE, ...AREE_LEGACY];
const LS_BASE = { label:'LS', nome:'Lavori Speciali', emoji:'🔧', bg:'#f59e0b', light:'#fffbeb', border:'#fcd34d' };

// ── FRASE DEL GIORNO ─────────────────────────────────────────────────────────
// Stesso pool e stessa logica di rotazione di PLAN, cosi' HRS e PLAN mostrano
// la STESSA frase nello stesso giorno. Override eventuale via tabella
// daily_phrase (gestita da PLAN, HRS solo legge). Read-only.
const QUOTE_EPOCH = new Date('2026-04-30T00:00:00.000Z');
const QUOTES = [
  ["Chi sa non parla. Chi parla non sa.","Lao Tzu"],
  ["Concentrati sul momento presente. Non perderti nel passato o nel futuro.","Marco Aurelio"],
  ["Chi vuole fare trova i modi, chi non vuole fare trova le scuse.","Proverbio"],
  ["Da soli possiamo fare così poco; insieme possiamo fare così tanto.","Helen Keller"],
  ["Hai potere sulla tua mente, non sugli eventi esterni. Realizza questo e troverai la forza.","Marco Aurelio"],
  ["Una vita senza esame non merita di essere vissuta.","Socrate"],
  ["Il meglio del meglio non è vincere cento battaglie, ma sottomettere il nemico senza combattere.","Sun Tzu"],
  ["La guerra è una serie di catastrofi che portano alla vittoria.","Napoleone Bonaparte"],
  ["Impara a volere ciò che hai.","Seneca"],
  ["Agisci con vigore e senza esitazione, ovunque la ragione ti conduca.","Marco Aurelio"],
  ["Il successo è la somma di piccoli sforzi ripetuti giorno dopo giorno.","Robert Collier"],
  ["Impossibile è solo una grande parola usata da persone piccole.","Muhammad Ali"],
  ["Non rimandare a domani quello che puoi fare oggi.","Benjamin Franklin"],
  ["Se non riesci più a correre per la vittoria, non è necessario correre affatto.","Ayrton Senna"],
  ["La nostra gloria più grande non è nel non cadere mai, ma nel rialzarci ogni volta che cadiamo.","Confucio"],
  ["Conosci te stesso.","Socrate"],
  ["Conosci i tuoi limiti e potrai spingerti oltre.","Lao Tzu"],
  ["Innovare significa dire no a mille cose.","Steve Jobs"],
  ["Non fare nulla che non sia utile.","Miyamoto Musashi"],
  ["La fortuna aiuta gli animi audaci.","Seneca"],
  ["La qualità della tua vita è determinata dalla qualità dei tuoi pensieri.","Marco Aurelio"],
  ["Cerca prima di essere un uomo di valore, poi cerca il successo.","Epitteto"],
  ["La vita ci chiede sempre e solo una cosa: essere all'altezza del momento.","Viktor Frankl"],
  ["Tra stimolo e risposta c'è uno spazio. In quello spazio sta il nostro potere di scegliere.","Viktor Frankl"],
  ["Sbagliare è umano, perseverare nell'errore è diabolico.","Seneca"],
  ["Sopporta e astieniti.","Epitteto"],
  ["È una grande abilità sapere quando fermarsi.","Seneca"],
  ["La nostra paura più grande non è di essere inadeguati, ma di essere potenti oltre ogni misura.","Nelson Mandela"],
  ["Conosci gli altri ed avrai la saggezza. Conosci te stesso ed avrai l'illuminazione.","Lao Tzu"],
  ["Il campione non è quello che non cade mai, ma quello che si rialza sempre.","Muhammad Ali"],
  ["La logica ti porterà da A a B. L'immaginazione ti porterà ovunque.","Albert Einstein"],
  ["Vivi come se dovessi morire domani. Impara come se dovessi vivere per sempre.","Mahatma Gandhi"],
  ["I guerrieri vittoriosi prima vincono e poi vanno in guerra.","Sun Tzu"],
  ["Il talento fa vincere le partite, ma il lavoro di squadra fa vincere i campionati.","Michael Jordan"],
  ["Scegli un lavoro che ami e non lavorerai un solo giorno della tua vita.","Confucio"],
  ["Le grandi cose negli affari non sono mai fatte da una sola persona; sono fatte da un team.","Steve Jobs"],
  ["Con ordine, affronta il disordine; con calma, l'irruenza.","Sun Tzu"],
  ["Impossibile è una parola che si trova solo nel dizionario degli sciocchi.","Napoleone Bonaparte"],
  ["Cerchiamo tutti di essere i leader che vorremmo avere.","Simon Sinek"],
  ["L'educazione è l'arma più potente che puoi usare per cambiare il mondo.","Nelson Mandela"],
  ["Puoi essere un grande giocatore solo se sei disposto a fare le cose che i mediocri non vogliono fare.","Kobe Bryant"],
  ["Se non è giusto, non farlo; se non è vero, non dirlo.","Marco Aurelio"],
  ["La differenza tra il possibile e l'impossibile sta nella determinazione.","Tommy Lasorda"],
  ["Il prezzo della grandezza è la responsabilità.","Winston Churchill"],
  ["Allenati come se non avessi mai vinto. Gareggia come se non avessi mai perso.","Kobe Bryant"],
  ["Essere un campione non è qualcosa che si indossa. È qualcosa che si vive.","Kobe Bryant"],
  ["Chi ha un perché per cui vivere può sopportare quasi qualsiasi come.","Viktor Frankl"],
  ["Chi impara ma non pensa è perduto. Chi pensa ma non impara è in pericolo.","Confucio"],
  ["La debolezza non può mai perdonare. Il perdono è l'attributo dei forti.","Mahatma Gandhi"],
  ["Tutti possono vedere le mie tattiche, nessuno può conoscere la mia strategia.","Sun Tzu"],
  ["Pensa con leggerezza di te stesso, pensa profondamente al mondo.","Miyamoto Musashi"],
  ["Non perdere mai. O vinci, o impari.","Nelson Mandela"],
  ["Chi vince sé stesso è veramente forte.","Lao Tzu"],
  ["Educare la mente senza educare il cuore non è affatto educazione.","Aristotele"],
  ["Il dolore è inevitabile. La sofferenza è una scelta.","Buddha"],
  ["Non vi è nulla di più orribile della vittoria, eccetto la sconfitta.","Arthur Wellesley"],
  ["Non importa quante volte cadi, ma quante volte ti rialzi.","Vince Lombardi"],
  ["Il successo non è definitivo, il fallimento non è fatale: è il coraggio di continuare che conta.","Winston Churchill"],
  ["La forza non viene dalla vittoria. Le lotte sviluppano i tuoi punti di forza.","Arnold Schwarzenegger"],
  ["Il silenzio è una fonte di grande forza.","Lao Tzu"],
  ["Chi vuole combattere deve prima calcolare i costi.","Sun Tzu"],
  ["Quando non possiamo più cambiare una situazione, siamo sfidati a cambiare noi stessi.","Viktor Frankl"],
  ["Il servizio agli altri è il prezzo che paghi per stare su questa terra.","Muhammad Ali"],
  ["Non smettere mai di fare domande.","Albert Einstein"],
  ["Agisci senza aspettative, guida senza dominare.","Lao Tzu"],
  ["Accetta le cose come sono. Non come vorresti che fossero.","Miyamoto Musashi"],
  ["Essere amato profondamente ti dà forza; amare profondamente ti dà coraggio.","Lao Tzu"],
  ["Aspettati il meglio da te stesso.","Michael Jordan"],
  ["Tutto scorre, nulla rimane.","Eraclito"],
  ["Se conosci il nemico e te stesso, la tua vittoria è sicura.","Sun Tzu"],
  ["Il leone usa tutta la sua forza anche per uccidere un coniglio.","Sun Tzu"],
  ["L'arte della guerra è di vitale importanza per lo Stato.","Sun Tzu"],
  ["Nessuno ci salva tranne noi stessi.","Buddha"],
  ["La vittoria non è tutto, ma voler vincere lo è.","Vince Lombardi"],
  ["In modo gentile puoi scuotere il mondo.","Mahatma Gandhi"],
  ["Tutto è degli altri, solo il tempo è nostro.","Seneca"],
  ["Cadere è umano, rialzarsi è eroico.","Proverbio"],
  ["L'uomo superiore è esigente con sé stesso; l'uomo mediocre è esigente con gli altri.","Confucio"],
  ["Sembra sempre impossibile finché non è fatto.","Nelson Mandela"],
  ["Non basta correre, bisogna partire in tempo.","François Rabelais"],
  ["Sii come la roccia contro cui le onde si infrangono: tiene duro e intorno ad essa le acque si calmano.","Marco Aurelio"],
  ["Il dolore è temporaneo. La gloria è per sempre.","Lance Armstrong"],
  ["C'è solo un bene: la conoscenza. E un solo male: l'ignoranza.","Socrate"],
  ["La fantasia è più importante della conoscenza.","Albert Einstein"],
  ["Il coraggio è la prima qualità umana perché è quella che garantisce tutte le altre.","Aristotele"],
  ["La disciplina è il ponte tra gli obiettivi e i risultati.","Jim Rohn"],
  ["Il tempo è il giudice più saggio.","Solone"],
  ["Galleggia come una farfalla, pungi come un'ape.","Muhammad Ali"],
  ["L'impegno individuale in uno sforzo di gruppo è quello che fa funzionare un team.","Vince Lombardi"],
  ["Sii veloce come il vento; immobile come una montagna.","Sun Tzu"],
  ["Agire senza agire: questo è il principio del saggio.","Lao Tzu"],
  ["Ho mancato oltre novemila tiri. Ho perso quasi trecento partite. Ed è per questo che ho avuto successo.","Michael Jordan"],
  ["Il coraggio non è l'assenza di paura, ma il giudizio che qualcosa è più importante della paura.","Napoleone Bonaparte"],
  ["Prima di intraprendere un viaggio di vendetta, scava due tombe.","Confucio"],
  ["Il coraggio è come l'amore: ha bisogno di speranza per nutrirsi.","Napoleone Bonaparte"],
  ["Il modo migliore per predire il futuro è crearlo.","Peter Drucker"],
  ["Il lavoro duro batte il talento quando il talento non lavora duro.","Kobe Bryant"],
  ["Il guerriero conosce la strategia; la strategia salva la vita.","Miyamoto Musashi"],
  ["Il dado è tratto.","Giulio Cesare"],
  ["Il carattere si rivela nelle difficoltà.","Eraclito"],
  ["Fai di ogni azione un capolavoro. Ogni giorno è una nuova opportunità.","Marco Aurelio"],
  ["Non è povero chi ha poco, ma chi desidera di più.","Seneca"],
  ["I leader non nascono. I leader si creano, e vengono creati dallo sforzo e dal duro lavoro.","Vince Lombardi"],
  ["Un vincitore è semplicemente un sognatore che non ha mai smesso.","Nelson Mandela"],
  ["Non interrompere il tuo nemico quando sta commettendo un errore.","Napoleone Bonaparte"],
  ["Non è ciò che ti accade a determinare la tua vita, ma come rispondi a ciò che ti accade.","Epitteto"],
  ["In campo di battaglia la verità è la prima vittima.","Eschilo"],
  ["Nessun vento è favorevole per chi non sa dove andare.","Seneca"],
  ["Un viaggio di mille miglia inizia con un singolo passo.","Lao Tzu"],
  ["Sogna in grande e osa fallire.","Norman Vaughan"],
  ["Non arrenderti mai. Non arrenderti mai. Non arrenderti mai.","Winston Churchill"],
  ["La virtù non è mai solitaria; ha sempre vicini.","Confucio"],
  ["L'ostacolo è la via.","Marco Aurelio"],
  ["Ogni volta che arrivi in fondo, trovi ancora di più.","Ayrton Senna"],
  ["Meglio essere padrone di sé stessi che padrone di mille uomini.","Buddha"],
  ["Viene, vide, vinse.","Giulio Cesare"],
  ["L'uomo che sposta le montagne comincia portando via i sassi più piccoli.","Confucio"],
  ["Ogni grande impresa inizia con l'audacia di immaginare che sia possibile.","Aristotele"],
  ["Tutto è mentale. Tutto.","Kobe Bryant"],
  ["Siamo ciò che facciamo ripetutamente. L'eccellenza non è un atto, ma un'abitudine.","Aristotele"],
  ["Costruisci al tuo avversario un ponte d'oro per consentirgli di ritirarsi.","Sun Tzu"],
  ["Il potere della mente è quello di essere invincibile.","Seneca"],
  ["Il pessimista vede la difficoltà in ogni opportunità; l'ottimista vede l'opportunità in ogni difficoltà.","Winston Churchill"],
  ["Sii il cambiamento che vuoi vedere nel mondo.","Mahatma Gandhi"],
  ["Un leader è un mercante di speranza.","Napoleone Bonaparte"],
  ["Per ogni minuto trascorso ad organizzarsi, si guadagna un'ora di lavoro.","Napoleone Bonaparte"],
  ["La pressione è un privilegio.","José Mourinho"],
  ["Simulare il disordine presume una perfetta disciplina.","Sun Tzu"],
  ["L'acqua è la cosa più morbida della terra, eppure dissolve la roccia più dura.","Lao Tzu"],
  ["Non puoi superare chi non si arrende mai.","Ayrton Senna"],
  ["Non rimpiangere ciò che hai fatto.","Miyamoto Musashi"],
  ["Prima ti ignorano, poi ti deridono, poi ti combattono, poi vinci.","Mahatma Gandhi"],
  ["Chi fa del bene agli altri fa bene anche a sé stesso.","Confucio"],
  ["Tratta i tuoi uomini come faresti con i tuoi amati figli.","Sun Tzu"],
  ["Un esercito di pecore guidato da un leone sconfigge un esercito di leoni guidato da una pecora.","Alessandro Magno"],
  ["Non abbiate paura dei grandi momenti. Abbiate paura di non provarci.","Kobe Bryant"],
  ["La pace viene dall'interno. Non cercarla fuori.","Buddha"],
  ["Il rischio è la parte più importante di ogni carriera.","Ayrton Senna"],
  ["Il rispetto si guadagna, l'onestà si apprezza, la fiducia si conquista, la lealtà si restituisce.","Proverbio"],
  ["Fai ciò che puoi, con ciò che hai, dove sei.","Theodore Roosevelt"],
  ["La fortuna aiuta i coraggiosi.","Giulio Cesare"],
  ["Sii veloce nel sentire, lento nel parlare, lento nell'ira.","Proverbio"],
  ["Nulla ha potere su di te se non glielo concedi tu.","Marco Aurelio"],
  ["Ogni esperto era una volta un principiante.","Proverbio"],
  ["La forza dell'esercito dipende dalla mente del condottiero.","Alessandro Magno"],
  ["Non limitarti a giocare. Vinci.","Kobe Bryant"],
  ["Non sprecare il resto della tua vita in pensieri su altre persone.","Marco Aurelio"],
  ["Non importa quanto vai lento, purché tu non ti fermi.","Confucio"],
  ["Una strategia senza tattiche è il cammino più lento verso la vittoria.","Sun Tzu"],
  ["La forza non viene dalla capacità fisica, ma da una volontà indomita.","Mahatma Gandhi"],
  ["Non è il luogo che nobilita l'uomo, ma l'uomo che nobilita il luogo.","Seneca"],
  ["Non sono arrogante, sono solo sicuro di me stesso.","José Mourinho"],
  ["Non aspettare il momento giusto. Il momento giusto è adesso.","Proverbio"],
  ["Mentre insegniamo, impariamo.","Seneca"],
  ["La fiducia si guadagna con i piccoli atti, non con le grandi promesse.","Simon Sinek"],
  ["Ogni campione era una volta un contendente che non si è mai arreso.","Rocky Balboa"],
  ["La cosa più difficile è conoscere sé stessi.","Talete di Mileto"],
  ["La perfezione non è raggiungibile, ma se inseguiamo la perfezione possiamo raggiungere l'eccellenza.","Vince Lombardi"],
  ["La libertà non si ottiene soddisfacendo i desideri, ma eliminando il desiderio.","Epitteto"],
  ["Frequenta coloro che ti renderanno migliore.","Seneca"],
  ["La mente è tutto. Ciò che pensi, diventi.","Buddha"],
  ["Tutto ha bellezza, ma non tutti riescono a vederla.","Confucio"],
  ["Quando sai una cosa, riconosci che la sai. Questa è la conoscenza.","Confucio"],
  ["Il successo è passare da un fallimento all'altro senza perdere l'entusiasmo.","Winston Churchill"],
  ["Il piano non sopravvive mai al primo contatto con il nemico.","Helmuth von Moltke"],
  ["Tre cose non possono essere nascoste a lungo: il sole, la luna e la verità.","Buddha"],
  ["La velocità del capo è la velocità della squadra.","Lee Iacocca"],
  ["Anche dopo la notte più lunga, il sole sorge sempre.","Buddha"],
  ["Non agire fuori dalla tua via.","Miyamoto Musashi"],
  ["Omnia, Lucili, aliena sunt, tempus tantum nostrum est. Tutto è degli altri; solo il tempo è nostro.","Seneca"],
  ["Non dire mai che hai perso la pace. Di' solo che non l'hai ancora trovata.","Epitteto"],
  ["La vittoria si ottiene quando si è preparati a ogni imprevisto.","Sun Tzu"],
  ["Correggi i tuoi errori senza indugio.","Confucio"],
  ["Non nuocere con le parole, le azioni o i pensieri.","Buddha"],
  ["Chi si ferma è perduto.","Proverbio"]
];
const getQuoteIndexForToday = () => {
  const oggi = new Date();
  const diffMs = oggi.getTime() - QUOTE_EPOCH.getTime();
  const giorni = Math.floor(diffMs / (1000*60*60*24));
  const idx = ((giorni % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return idx;
};

// ── PDF ───────────────────────────────────────────────────────────────────────
// Carica jsPDF + jspdf-autotable dinamicamente (una sola volta), con fallback CDN
let jspdfPromise = null;
const loadJsPdf = () => {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf);
  if (jspdfPromise) return jspdfPromise;
  const tryLoad = (urls) => new Promise((resolve, reject) => {
    let idx = 0;
    const next = () => {
      if (idx >= urls.length) return reject(new Error('Tutti i CDN PDF hanno fallito (verifica connessione)'));
      const s = document.createElement('script');
      s.src = urls[idx++];
      s.onload = resolve;
      s.onerror = () => { document.head.removeChild(s); next(); };
      document.head.appendChild(s);
    };
    next();
  });
  jspdfPromise = (async () => {
    await tryLoad([
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ]);
    await tryLoad([
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
      'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
    ]);
    return window.jspdf;
  })().catch(e => { jspdfPromise = null; throw e; });
  return jspdfPromise;
};

// Overlay loading
const showPdfLoading = (msg) => {
  if (document.getElementById('pdf-loading-ov')) return;
  const ov = document.createElement('div');
  ov.id = 'pdf-loading-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Arial,sans-serif;';
  ov.innerHTML = `<style>@keyframes spinPdf{to{transform:rotate(360deg)}}</style><div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinPdf 0.8s linear infinite;margin-bottom:16px"></div><div style="font-weight:600;font-size:15px">${msg||'Generazione PDF...'}</div>`;
  document.body.appendChild(ov);
};
const hidePdfLoading = () => { const ov=document.getElementById('pdf-loading-ov'); if(ov) ov.remove(); };

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// Condivide o scarica il PDF generato
async function condividiPdf(blob, fileName, fileTitle, fileText) {
  const file = new File([blob], fileName, { type:'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files:[file] })) {
    try {
      await navigator.share({ title:fileTitle, text:fileText, files:[file] });
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, fileName);
}

// Costanti styling PDF
const PDF_RED = [196, 18, 48];      // #c41230 DELTAgroup red
const PDF_GRAY = [107, 114, 128];   // #6b7280
const PDF_DARK = [17, 24, 39];      // #111827
const PDF_LIGHT = [249, 250, 251];  // #f9fafb

// Header PDF (logo testuale + titolo)
function pdfHeader(doc, titolo, sottotitolo) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PDF_RED);
  doc.text('DELTAgroup Security & Services AG', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_GRAY);
  doc.text('Filiale Ticino', 14, 21);
  doc.setDrawColor(...PDF_RED);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 196, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PDF_DARK);
  doc.text(titolo, 14, 32);
  if (sottotitolo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_GRAY);
    doc.text(sottotitolo, 14, 38);
  }
}

// Footer PDF (versione + data, su ogni pagina)
function pdfFooter(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_GRAY);
  doc.text(`DELTAgroup HRS ${APP_VERSION} — ${fmtDateShort(todayIso())}`, 14, pageH - 8);
}

// Scrive il totale ore inline (subito dopo le tabelle)
function pdfTotaleInline(doc, yPos, label, totOre) {
  doc.setDrawColor(...PDF_RED);
  doc.setLineWidth(0.6);
  doc.line(14, yPos, 196, yPos);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_RED);
  doc.text(`${label}: ${totOre.toFixed(2)}h`, 196, yPos + 6, { align: 'right' });
  return yPos + 10;
}

async function apriPdfRapporto(area, agentiSez, osservazione, dataIso) {
  const dateFmt = fmtDateLong(dataIso);
  const sezNome = area.nome;
  const fileTitle = `Rapporto di Servizio - ${sezNome} - ${fmtDateShort(dataIso)}`;
  const fileName  = `rapporto_${sezNome.replace(/\s+/g,'_').toLowerCase()}_${dataIso}.pdf`;
  const fileText  = `Rapporto di Servizio HRS - ${sezNome} - ${dateFmt}`;

  showPdfLoading();
  try {
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    pdfHeader(doc, 'Rapporto di Servizio', `${sezNome}  ·  ${dateFmt}`);

    const totOre = agentiSez.filter(a=>a.area!=='ASS').reduce((t,a)=>t+calcOre(a.inizio,a.fine,a.pausa),0);
    const agentiSezOrd = [...agentiSez].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','it'));
    const rows = agentiSezOrd.map(a => {
      if (a.area==='ASS') return [a.nome, { content:'ASSENTE'+(a.nota?' — '+a.nota:''), colSpan:3, styles:{textColor:[220,38,38],fontStyle:'bold'} }, '—'];
      const ore = calcOre(a.inizio,a.fine,a.pausa);
      return [a.nome, fmtTime(a.inizio), fmtTime(a.fine), `${a.pausa ?? 30}'`, `${ore.toFixed(2)}h`];
    });

    doc.autoTable({
      startY: 44,
      head: [['Collaboratore','Inizio','Fine','Pausa','Ore eff.']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: PDF_LIGHT, textColor: PDF_DARK, fontStyle:'bold', fontSize:9, halign:'center', lineColor:PDF_RED, lineWidth:{bottom:0.5} },
      bodyStyles: { fontSize:10, lineColor:[229,231,235] },
      columnStyles: { 0:{halign:'left',fontStyle:'bold'}, 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center',fontStyle:'bold'} },
      margin: { left:14, right:14 }
    });

    if (osservazione) {
      const y = doc.lastAutoTable.finalY + 6;
      doc.setFillColor(...PDF_LIGHT);
      doc.setDrawColor(229,231,235);
      doc.roundedRect(14, y, 182, 20, 1, 1, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...PDF_GRAY);
      doc.text('LAVORO SVOLTO', 18, y + 6);
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...PDF_DARK);
      const lines = doc.splitTextToSize(osservazione, 174);
      doc.text(lines.slice(0,3), 18, y + 12);
    }

    const yTot = (osservazione ? doc.lastAutoTable.finalY + 30 : doc.lastAutoTable.finalY + 6);
    pdfTotaleInline(doc, yTot, 'TOTALE ORE', totOre);
    pdfFooter(doc);
    const blob = doc.output('blob');
    await condividiPdf(blob, fileName, fileTitle, fileText);
  } catch(e) {
    console.error('PDF error:', e);
    alert('Errore generazione PDF: ' + (e.message||e));
  } finally {
    hidePdfLoading();
  }
}

async function apriPdfGenerale(agenti, datiAgenti, osservazioni, lavorazioni, dataIso) {
  const dateFmt = fmtDateLong(dataIso);
  const fileTitle = `Rapporto Generale HRS - ${fmtDateShort(dataIso)}`;
  const fileName  = `rapporto_generale_hrs_${dataIso}.pdf`;
  const fileText  = `Rapporto Generale HRS Stadio - ${dateFmt}`;

  showPdfLoading();
  try {
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    pdfHeader(doc, 'Rapporto di Servizio — Riepilogo Generale', `HRS Stadio  ·  ${dateFmt}`);

    const aree = [...AREE_TUTTE, ...lavorazioni.map(l=>({...LS_BASE,id:`LS_${l.id}`,nome:l.nome}))];
    let totGlob = 0;
    let yPos = 44;

    aree.forEach(area => {
      const agSez = agenti.filter(a=>getSegmenti(datiAgenti[a.id]).some(s=>s.area===area.id)).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','it'));
      if (agSez.length===0) return;
      const segPerAgente = agSez.map(a => ({ ag:a, seg: getSegmenti(datiAgenti[a.id]).find(s=>s.area===area.id) || {}, d: datiAgenti[a.id]||{} }));
      const totSez = area.id==='ASS' ? 0 : segPerAgente.reduce((t,x)=>t+calcOre(x.seg.inizio,x.seg.fine,x.seg.pausa),0);
      totGlob += totSez;
      const rows = segPerAgente.map(({ag,seg,d})=>{
        if (area.id==='ASS') return [ag.nome, { content:'ASSENTE'+(d.nota?' — '+d.nota:''), colSpan:3, styles:{textColor:[220,38,38]} }, '—'];
        const ore = calcOre(seg.inizio,seg.fine,seg.pausa);
        const hasSplit = getSegmenti(d).length > 1;
        return [ag.nome + (hasSplit?' *':''), fmtTime(seg.inizio), fmtTime(seg.fine), `${seg.pausa ?? 0}'`, `${ore.toFixed(2)}h`];
      });

      // Banda titolo sezione
      doc.setFillColor(243,244,246);
      doc.rect(14, yPos, 182, 7, 'F');
      doc.setDrawColor(...PDF_RED); doc.setLineWidth(1);
      doc.line(14, yPos, 14, yPos+7);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...PDF_DARK);
      doc.text(`${area.nome} — tot. ${totSez.toFixed(2)}h`, 17, yPos + 5);

      doc.autoTable({
        startY: yPos + 8,
        head: [['Collaboratore','Inizio','Fine','Pausa','Ore']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor:[255,255,255], textColor:PDF_GRAY, fontStyle:'normal', fontSize:8, halign:'center', lineColor:PDF_RED, lineWidth:{bottom:0.3} },
        bodyStyles: { fontSize:9, lineColor:[229,231,235] },
        columnStyles: { 0:{halign:'left',fontStyle:'bold'}, 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center',fontStyle:'bold'} },
        margin: { left:14, right:14 }
      });

      yPos = doc.lastAutoTable.finalY + 2;
      const oss = osservazioni[area.id];
      if (oss) {
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...PDF_GRAY);
        const lines = doc.splitTextToSize(`Lavoro svolto: ${oss}`, 178);
        doc.text(lines.slice(0,2), 16, yPos + 4);
        yPos += 4 + lines.slice(0,2).length * 4;
      }
      yPos += 4;

      if (yPos > 260) { doc.addPage(); yPos = 20; }
    });

    // Se non c'è abbastanza spazio per il totale, aggiungo nuova pagina
    if (yPos > 270) { doc.addPage(); yPos = 20; }
    pdfTotaleInline(doc, yPos, 'TOTALE ORE GIORNATA', totGlob);
    pdfFooter(doc);
    const blob = doc.output('blob');
    await condividiPdf(blob, fileName, fileTitle, fileText);
  } catch(e) {
    console.error('PDF error:', e);
    alert('Errore generazione PDF: ' + (e.message||e));
  } finally {
    hidePdfLoading();
  }
}

// PDF di un periodo: per ogni giorno del periodo, le sezioni con dati
async function apriPdfPeriodo(reportsInPeriodo, tipo, areaFiltro, dataDa, dataA) {
  const periodoLabel = `${fmtDateShort(dataDa)} — ${fmtDateShort(dataA)}`;
  const tipoLabel = tipo === 'sezione' ? (areaFiltro?.nome || 'Sezione') : 'Riepilogo Generale';
  const fileTitle = `Rapporto Periodo HRS - ${tipoLabel} - ${periodoLabel}`;
  const fileName  = `rapporto_periodo_${tipo}${areaFiltro?'_'+areaFiltro.nome.toLowerCase().replace(/\s+/g,'_'):''}_${dataDa}_${dataA}.pdf`;
  const fileText  = `Rapporto HRS — ${tipoLabel} dal ${fmtDateShort(dataDa)} al ${fmtDateShort(dataA)}`;

  if (reportsInPeriodo.length === 0) {
    alert('Nessun rapporto nel periodo selezionato.');
    return;
  }

  showPdfLoading('Caricamento rapporti...');
  try {
    const c = await sb();
    const reportIds = reportsInPeriodo.map(r=>r.id);
    const { data: allEntries } = await c.from('hrs_report_entries').select('*').in('report_id', reportIds);
    const { data: allSections } = await c.from('hrs_report_sections').select('*').in('report_id', reportIds);
    const entriesByReport = {}; (allEntries||[]).forEach(e=>{(entriesByReport[e.report_id]=entriesByReport[e.report_id]||[]).push(e);});
    const sectionsByReport = {}; (allSections||[]).forEach(s=>{(sectionsByReport[s.report_id]=sectionsByReport[s.report_id]||[]).push(s);});

    showPdfLoading('Generazione PDF...');
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    pdfHeader(doc, `Rapporto Periodo — ${tipoLabel}`, `HRS Stadio  ·  ${fmtDateLong(dataDa)} — ${fmtDateLong(dataA)}`);

    const ordinati = [...reportsInPeriodo].sort((a,b)=>a.date.localeCompare(b.date));
    let totGlob = 0;
    let yPos = 44;
    const pageH = doc.internal.pageSize.getHeight();

    for (let i = 0; i < ordinati.length; i++) {
      const r = ordinati[i];
      const entries = entriesByReport[r.id] || [];
      const sections = sectionsByReport[r.id] || [];
      const lavNomi = [...new Set(entries.filter(e=>e.area?.startsWith('LS_')).map(e=>e.lavorazione_nome).filter(Boolean))];
      const lavRpt = lavNomi.map((nome,i)=>({id:`a${i}`,nome}));
      const aree = [...AREE_TUTTE, ...lavRpt.map(l=>({...LS_BASE,id:`LS_a${l.id}`,nome:l.nome}))];
      const ossMap = {}; sections.forEach(s=>{ossMap[s.area]=s.osservazione;});

      const areeDaMostrare = tipo === 'sezione'
        ? aree.filter(a => a.id === areaFiltro.id)
        : aree;

      const sezioniConDati = areeDaMostrare.map(area => {
        const entriesArea = entries.filter(e => e.area === area.id).sort((a,b)=>(a.agent_name||'').localeCompare(b.agent_name||'','it'));
        if (entriesArea.length === 0) return null;
        const totSez = area.id === 'ASS' ? 0 : entriesArea.reduce((t,e)=>t+calcOre(e.inizio,e.fine,e.pausa),0);
        return { area, entriesArea, totSez };
      }).filter(Boolean);

      if (sezioniConDati.length === 0) continue;

      const stimaH = 14 + sezioniConDati.reduce((s, {entriesArea}) => s + 14 + entriesArea.length * 6, 0);
      if (yPos + stimaH > pageH - 25 && yPos > 44) { doc.addPage(); yPos = 20; }

      // Intestazione giorno
      doc.setFillColor(...PDF_RED);
      doc.rect(14, yPos, 182, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
      doc.text(fmtDateLong(r.date), 17, yPos + 5);
      if (r.submitted_at) {
        const ora = new Date(r.submitted_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
        doc.setFontSize(9); doc.setFont('helvetica','normal');
        doc.text(`Inviato ${ora}${r.version>1?` · v${r.version}`:''}`, 193, yPos + 5, { align:'right' });
      }
      yPos += 9;

      let totGiorno = 0;
      sezioniConDati.forEach(({ area, entriesArea, totSez }) => {
        totGiorno += totSez;
        const rows = entriesArea.map(e => {
          if (e.area === 'ASS') return [e.agent_name, { content:'ASSENTE'+(e.nota?' — '+e.nota:''), colSpan:3, styles:{textColor:[220,38,38]} }, '—'];
          return [e.agent_name, fmtTime(e.inizio), fmtTime(e.fine), `${e.pausa ?? 30}'`, `${calcOre(e.inizio,e.fine,e.pausa).toFixed(2)}h`];
        });

        doc.setFillColor(243,244,246);
        doc.rect(14, yPos, 182, 6, 'F');
        doc.setDrawColor(...PDF_RED); doc.setLineWidth(1);
        doc.line(14, yPos, 14, yPos + 6);
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...PDF_DARK);
        doc.text(`${area.nome} — tot. ${totSez.toFixed(2)}h`, 17, yPos + 4);
        yPos += 7;

        doc.autoTable({
          startY: yPos,
          head: [['Collaboratore','Inizio','Fine','Pausa','Ore']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor:[255,255,255], textColor:PDF_GRAY, fontStyle:'normal', fontSize:8, halign:'center', lineColor:PDF_RED, lineWidth:{bottom:0.3} },
          bodyStyles: { fontSize:8, lineColor:[229,231,235] },
          columnStyles: { 0:{halign:'left',fontStyle:'bold'}, 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center',fontStyle:'bold'} },
          margin: { left:14, right:14 }
        });
        yPos = doc.lastAutoTable.finalY + 1;

        const oss = ossMap[area.id];
        if (oss) {
          doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...PDF_GRAY);
          const lines = doc.splitTextToSize(`Lavoro svolto: ${oss}`, 178);
          doc.text(lines.slice(0,2), 16, yPos + 3);
          yPos += 3 + lines.slice(0,2).length * 3;
        }
        yPos += 2;
      });

      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...PDF_RED);
      doc.text(`Totale giorno: ${totGiorno.toFixed(2)}h`, 193, yPos + 2, { align:'right' });
      yPos += 7;
      totGlob += totGiorno;
    }

    if (yPos > pageH - 25) { doc.addPage(); yPos = 20; }
    pdfTotaleInline(doc, yPos, `TOTALE PERIODO${tipo==='sezione'?' — '+areaFiltro.nome.toUpperCase():''}`, totGlob);

    const totPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totPages; p++) {
      doc.setPage(p);
      pdfFooter(doc);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...PDF_GRAY);
      doc.text(`Pag. ${p}/${totPages}`, 196, pageH - 8, { align:'right' });
    }

    const blob = doc.output('blob');
    await condividiPdf(blob, fileName, fileTitle, fileText);
  } catch(e) {
    console.error('PDF Periodo error:', e);
    alert('Errore generazione PDF: ' + (e.message||e));
  } finally {
    hidePdfLoading();
  }
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
  // Aree presenti nei segmenti correnti (per riconoscere legacy come GF in rapporti storici).
  const areeCorrenti = [dati.area, ...(dati.segmenti||[]).map(s=>s.area)].filter(Boolean);
  const legacyDaMostrare = AREE_LEGACY.filter(a => areeCorrenti.includes(a.id));
  const tutteAree = [
    ...AREE_FISSE,
    ...legacyDaMostrare,
    ...lavorazioni.map(l => ({...LS_BASE, id:`LS_${l.id}`, label:l.nome.slice(0,6), nome:l.nome}))
  ];
  const areeUtili = tutteAree.filter(a => a.id !== 'ASS');
  const isSplit = Array.isArray(dati.segmenti) && dati.segmenti.length > 0;
  const areaSingola = tutteAree.find(a => a.id === dati.area);
  const oreSplit = isSplit ? dati.segmenti.filter(s=>s.area&&s.area!=='ASS').reduce((t,s)=>t+calcOre(s.inizio,s.fine,s.pausa),0) : 0;

  const attivaSplit = () => {
    const p = { area: dati.area || areeUtili[0]?.id, inizio: dati.inizio || '07:00', fine: dati.fine || '12:00', pausa: '0' };
    const s = { area: null, inizio: '13:00', fine: dati.fine && dati.fine>'13:00' ? dati.fine : '17:00', pausa: '0' };
    onChange({ segmenti:[p, s], nota: dati.nota || '' });
  };
  const setSeg = (idx, patch) => {
    const next = dati.segmenti.map((s,i)=>i===idx?{...s,...patch}:s);
    onChange({ ...dati, segmenti: next });
  };
  const addSeg = () => {
    const ultimo = dati.segmenti[dati.segmenti.length-1];
    const nuovo = { area:null, inizio: ultimo?.fine || '17:00', fine: '19:00', pausa:'0' };
    onChange({ ...dati, segmenti: [...dati.segmenti, nuovo] });
  };
  const rmSeg = (idx) => {
    if (dati.segmenti.length <= 2) {
      // Ritorna al formato semplice usando il primo segmento
      const primo = dati.segmenti[idx===0?1:0];
      onChange({ area: primo.area, inizio: primo.inizio, fine: primo.fine, pausa: primo.pausa || '30', nota: dati.nota || '' });
    } else {
      onChange({ ...dati, segmenti: dati.segmenti.filter((_,i)=>i!==idx) });
    }
  };

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

        {!isSplit && <>
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
              placeholder="Nota collaboratore…" rows={2}
              style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:12, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#f9fafb', boxSizing:'border-box', marginBottom:'0.75rem' }}/>
            <button onClick={attivaSplit}
              style={{ width:'100%', padding:'0.7rem', borderRadius:12, border:'2px dashed #cbd5e1', background:'#f8fafc', color:'#475569', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', marginBottom:'1rem' }}>
              🔀 Splitta in due o piu' aree (turno spezzato)
            </button>
          </>}
          {dati.area==='ASS' && (
            <textarea value={dati.nota||''} onChange={e=>onChange({...dati,nota:e.target.value})}
              placeholder="Motivo assenza…" rows={2}
              style={{ width:'100%', border:'2px solid #fecaca', borderRadius:12, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#fef2f2', boxSizing:'border-box', marginBottom:'1rem' }}/>
          )}
        </>}

        {isSplit && <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em' }}>Turno spezzato · {oreSplit.toFixed(2)}h totali</div>
            <button onClick={()=>onChange({area:dati.segmenti[0]?.area, inizio:dati.segmenti[0]?.inizio, fine:dati.segmenti[dati.segmenti.length-1]?.fine, pausa:'30', nota:dati.nota||''})}
              style={{ fontSize:'0.7rem', background:'#fef3c7', color:'#92400e', border:'none', borderRadius:8, padding:'4px 8px', fontWeight:700, cursor:'pointer' }}>
              Torna a singolo
            </button>
          </div>
          {dati.segmenti.map((seg, idx) => {
            const areaSeg = tutteAree.find(a=>a.id===seg.area);
            const oreSeg = calcOre(seg.inizio, seg.fine, seg.pausa);
            return (
              <div key={idx} style={{ border:`2px solid ${areaSeg?.border||'#e5e7eb'}`, background:areaSeg?.light||'#f9fafb', borderRadius:14, padding:'0.75rem', marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:800, color:'#374151' }}>Segmento {idx+1} · {oreSeg.toFixed(2)}h</span>
                  <button onClick={()=>rmSeg(idx)}
                    style={{ background:'#fff', border:'1px solid #fecaca', color:'#dc2626', borderRadius:8, padding:'2px 8px', fontSize:'0.7rem', fontWeight:700, cursor:'pointer' }}>× Rimuovi</button>
                </div>
                <select value={seg.area||''} onChange={e=>setSeg(idx,{area:e.target.value||null})}
                  style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:10, padding:'0.6rem', fontSize:'0.9rem', background:'#fff', marginBottom:8 }}>
                  <option value="">— Seleziona area —</option>
                  {areeUtili.map(a=><option key={a.id} value={a.id}>{a.emoji} {a.nome}</option>)}
                </select>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 78px', gap:8 }}>
                  <input type="time" value={seg.inizio||'07:00'} onChange={e=>setSeg(idx,{inizio:e.target.value})}
                    style={{ border:'2px solid #e5e7eb', borderRadius:10, padding:'0.55rem 0.4rem', fontSize:'0.95rem', background:'#fff', boxSizing:'border-box' }}/>
                  <input type="time" value={seg.fine||'12:00'} onChange={e=>setSeg(idx,{fine:e.target.value})}
                    style={{ border:'2px solid #e5e7eb', borderRadius:10, padding:'0.55rem 0.4rem', fontSize:'0.95rem', background:'#fff', boxSizing:'border-box' }}/>
                  <select value={seg.pausa ?? '0'} onChange={e=>setSeg(idx,{pausa:e.target.value})}
                    style={{ border:'2px solid #e5e7eb', borderRadius:10, padding:'0.55rem 4px', fontSize:'0.9rem', background:'#fff', boxSizing:'border-box' }}>
                    {['0','15','30','45','60'].map(v=><option key={v}>{v}'</option>)}
                  </select>
                </div>
              </div>
            );
          })}
          <button onClick={addSeg}
            style={{ width:'100%', padding:'0.7rem', borderRadius:12, border:'2px dashed #cbd5e1', background:'#f8fafc', color:'#475569', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', marginBottom:'0.75rem' }}>
            + Aggiungi segmento
          </button>
          <textarea value={dati.nota||''} onChange={e=>onChange({...dati,nota:e.target.value})}
            placeholder="Nota collaboratore…" rows={2}
            style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:12, padding:'0.75rem', fontSize:'0.95rem', resize:'none', background:'#f9fafb', boxSizing:'border-box', marginBottom:'1rem' }}/>
        </>}

        <button onClick={onChiudi}
          style={{ width:'100%', padding:'1rem', borderRadius:16, border:'none', background:(isSplit||dati.area)?(areaSingola?.bg||'#2563eb'):'#e5e7eb', color:(isSplit||dati.area)?'#fff':'#9ca3af', fontWeight:800, fontSize:'1rem', cursor:'pointer' }}>
          {(isSplit||dati.area)?'Salva':'Chiudi'}
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
    ...AREE_TUTTE,
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
          const agentiSez = agenti.filter(a => getSegmenti(datiAgenti[a.id]).some(s=>s.area===area.id));
          if (agentiSez.length===0) return null;
          // Per split: passa i dati del segmento specifico di questa area (non l'intero orario)
          const datiSez = agentiSez.map(a => {
            const d = datiAgenti[a.id] || {};
            const seg = getSegmenti(d).find(s=>s.area===area.id) || {};
            return { nome:a.nome, area:area.id, inizio:seg.inizio, fine:seg.fine, pausa:seg.pausa, nota:d.nota };
          });
          const oss = osservazioni[area.id]||'';
          return (
            <button key={area.id} onClick={()=>{ apriPdfRapporto(area, datiSez, oss, dataOggi); onChiudi(); }}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'1rem', background:area.light, border:`1px solid ${area.border}`, borderRadius:14, marginBottom:8, cursor:'pointer' }}>
              <span style={{ fontSize:'1.25rem' }}>{area.emoji}</span>
              <div style={{ textAlign:'left', flex:1 }}>
                <div style={{ fontWeight:700, color:'#111827', fontSize:'0.9rem' }}>{area.nome}</div>
                <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>{agentiSez.length} collaboratori</div>
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
  const [bozzaBanner, setBozzaBanner] = useState(null);
  const bozzaRipristinataRef = useRef(false);
  const BOZZA_KEY = `hrs-bozza-${dataOggi}`;

  // Ripristino bozza salvata (solo se il rapporto non e' ancora stato inviato).
  // Si esegue quando cambia la data: se esiste una bozza per quella data, la applica.
  useEffect(() => {
    bozzaRipristinataRef.current = false;
    if (inviato) return;
    try {
      const raw = localStorage.getItem(BOZZA_KEY);
      if (!raw) return;
      const bozza = JSON.parse(raw);
      if (!bozza) return;
      // Evita di sovrascrivere se l'utente ha gia' iniziato ad assegnare in questa sessione.
      const giaAssegnato = Object.values(datiAgenti).some(d => d && (d.area || (Array.isArray(d.segmenti) && d.segmenti.some(s=>s.area))));
      if (giaAssegnato) return;
      if (Array.isArray(bozza.extraJas) && bozza.extraJas.length > 0) {
        const ids = new Set(agenti.map(a=>a.id));
        const nuoviExtra = bozza.extraJas.filter(a => !ids.has(a.id));
        if (nuoviExtra.length > 0) setAgenti(p => [...p, ...nuoviExtra]);
      }
      if (bozza.datiAgenti && Object.keys(bozza.datiAgenti).length > 0) setDatiAgenti(bozza.datiAgenti);
      if (bozza.osservazioni && Object.keys(bozza.osservazioni).length > 0) setOsservazioni(bozza.osservazioni);
      if (Array.isArray(bozza.lavorazioni) && bozza.lavorazioni.length > 0) setLavorazioni(bozza.lavorazioni);
      if (bozza.notaGen) setNotaGen(bozza.notaGen);
      bozzaRipristinataRef.current = true;
      setBozzaBanner({ ts: bozza.ts });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOggi, inviato]);

  // Autosalvataggio debounced della bozza corrente in localStorage.
  useEffect(() => {
    if (inviato) return;
    const t = setTimeout(() => {
      try {
        const extraJas = agenti.filter(a => a.extra === true);
        const hasQualcosa = extraJas.length > 0
          || Object.values(datiAgenti).some(d => d && (d.area || (Array.isArray(d.segmenti) && d.segmenti.some(s=>s.area)) || d.nota))
          || Object.values(osservazioni).some(v => v)
          || lavorazioni.length > 0
          || notaGen;
        if (hasQualcosa) {
          localStorage.setItem(BOZZA_KEY, JSON.stringify({
            ts: Date.now(), extraJas, datiAgenti, osservazioni, lavorazioni, notaGen
          }));
        }
      } catch {}
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenti, datiAgenti, osservazioni, lavorazioni, notaGen, inviato, dataOggi]);

  const scartaBozza = () => {
    try { localStorage.removeItem(BOZZA_KEY); } catch {}
    setBozzaBanner(null);
    setDatiAgenti({}); setOsservazioni({}); setLavorazioni([]); setNotaGen('');
    // Rimuovi solo gli extra JAS aggiunti; i pianificati restano.
    setAgenti(p => p.filter(a => !a.extra));
    bozzaRipristinataRef.current = false;
  };

  const upd = (id,d) => setDatiAgenti(p=>({...p,[id]:d}));
  // Un agente e' "assegnato" se ha un'area (formato semplice) o almeno un segmento con area (formato split).
  const isAssegnato = ag => {
    const d = datiAgenti[ag.id];
    if (!d) return false;
    if (Array.isArray(d.segmenti)) return d.segmenti.some(s=>s.area);
    return !!d.area;
  };
  const nonAss = agenti.filter(a=>!isAssegnato(a));
  const assegnati = agenti.length - nonAss.length;
  const agenteAperto = modaleAgente!==null ? agenti.find(a=>a.id===modaleAgente) : null;

  const doInvia = async () => {
    setSalvando(true);
    try {
      const c = await sb();
      // Per extra di JAS: agent_id è preservato (è un vero agente dal DB) — serve per creare shift PLAN
      // Solo gli extra "manuali" (digitati a mano, id stringa tipo "extra_xxx") avrebbero agent_id null
      // Espande ogni collaboratore in 1 o piu' entries a seconda dei segmenti.
      // Formato semplice → 1 entry (come prima). Formato split → 1 entry per segmento.
      const nomeLS = code => (code||'').startsWith('LS_') ? lavorazioni.find(l=>`LS_${l.id}`===code)?.nome || null : null;
      const entries = agenti.flatMap(ag => {
        const d = datiAgenti[ag.id]||{};
        const isMan = ag.extra && typeof ag.id === 'string' && ag.id.startsWith('extra_');
        const base = {
          agent_id: isMan ? null : ag.id,
          agent_name: ag.nome,
          is_extra: ag.extra||false,
          shift_inizio: ag.shift_inizio||null,
          shift_fine: ag.shift_fine||null,
        };
        const segs = getSegmenti(d);
        return segs.filter(s=>s.area).map((s, idx) => ({
          ...base,
          area: s.area,
          lavorazione_nome: nomeLS(s.area),
          inizio: s.inizio || null,
          fine: s.fine || null,
          pausa: parseInt(s.pausa ?? 30),
          // La nota "collaboratore" va sulla prima entry per non duplicarla nel PDF.
          nota: idx === 0 ? (d.nota || null) : null,
        }));
      });

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
      if (entries.length>0) {
        const { data: insertedEntries } = await c.from('hrs_report_entries').insert(entries.map(e=>({...e,report_id:reportId}))).select();

        // Per ogni extra con agent_id valido (non manuale): crea/aggiorna la shift PLAN.
        // Nota: se l'agente ha un turno SPLIT (piu' entries per stesso agent_id),
        // aggreghiamo in un'unica shift con start=min, end=max, actual_h=somma segmenti.
        const extrasByAgent = {};
        (insertedEntries||[]).forEach(e => {
          if (!(e.is_extra && e.agent_id && e.area !== 'ASS' && e.inizio && e.fine)) return;
          if (!extrasByAgent[e.agent_id]) extrasByAgent[e.agent_id] = [];
          extrasByAgent[e.agent_id].push(e);
        });
        const extraAgentIds = Object.keys(extrasByAgent);
        if (extraAgentIds.length > 0) {
          try {
            let hrsServiceId = null;
            const { data: svcData } = await c.from('services').select('id').ilike('name','%HRS%Stadio%').limit(1);
            if (svcData && svcData[0]) hrsServiceId = svcData[0].id;

            for (const agId of extraAgentIds) {
              const segs = extrasByAgent[agId].sort((a,b)=>String(a.inizio).localeCompare(String(b.inizio)));
              const startAgg = segs[0].inizio;
              const endAgg = segs[segs.length-1].fine;
              const oreAgg = segs.reduce((t,s)=>t+calcOre(s.inizio,s.fine,s.pausa), 0);
              const notesAgg = segs.length > 1
                ? `Split HRS: ${segs.map(s=>`${s.area} ${String(s.inizio).slice(0,5)}-${String(s.fine).slice(0,5)}`).join(' + ')}`
                : 'Aggiunto come extra da JAS via HRS';

              const { data: existingShifts } = await c.from('shifts')
                .select('id, from_hrs_extra')
                .eq('agent_id', agId).eq('date', dataOggi).limit(1);

              let shiftId = null;
              if (existingShifts && existingShifts.length > 0) {
                shiftId = existingShifts[0].id;
                if (existingShifts[0].from_hrs_extra) {
                  await c.from('shifts').update({
                    start_time: startAgg,
                    end_time: endAgg,
                    actual_h: oreAgg,
                    notes: notesAgg,
                  }).eq('id', shiftId);
                }
              } else {
                const { data: newShift } = await c.from('shifts').insert({
                  agent_id: agId,
                  service_id: hrsServiceId,
                  date: dataOggi,
                  start_time: startAgg,
                  end_time: endAgg,
                  actual_h: oreAgg,
                  notes: notesAgg,
                  from_hrs_extra: true,
                }).select().single();
                if (newShift) shiftId = newShift.id;
              }

              // Linka tutte le entries (una per segmento) alla stessa shift.
              if (shiftId) {
                for (const s of segs) {
                  await c.from('hrs_report_entries').update({ linked_shift_id: shiftId }).eq('id', s.id);
                }
              }
            }
          } catch(e) { console.warn('Shift autocreate error:', e); }
        }
      }
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
      await sendTelegram(`${isCorr?`🔄 <b>RAPPORTO CORRETTO</b> (v${newVersion})`:'📋 JAS ha inviato il <b>rapporto</b>'} HRS del ${fmtDateLong(dataOggi)} · ${oraInvio} · ${numAg} col. · ${totOre.toFixed(2)}h`);
      setInviato(true);
      setReportOggi({ id:reportId, date:dataOggi, submitted_at:reportOggi?.submitted_at||new Date().toISOString(), updated_at:new Date().toISOString(), version:newVersion, status:isCorr?'corrected':'submitted' });
      // Rapporto inviato → bozza non serve piu'
      try { localStorage.removeItem(BOZZA_KEY); } catch {}
      setBozzaBanner(null);
    } catch(e) { console.error(e); alert('Errore durante il salvataggio. Riprova.'); }
    setSalvando(false); setConferma(false);
  };

  const renderSezione = (area) => {
    // Un agente appare in una sezione se ha almeno un segmento con quell'area.
    const agentiSez = agenti.filter(a=>getSegmenti(datiAgenti[a.id]).some(s=>s.area===area.id)).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','it'));
    return (
      <div key={area.id} style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:area.light, border:`1px solid ${area.border}`, borderRadius:14, padding:'0.75rem 1rem', marginBottom:6 }}>
          <span style={{ fontWeight:700, color:'#111827' }}>{area.emoji} {area.nome}</span>
          <span style={{ background:area.bg, color:'#fff', borderRadius:99, padding:'2px 10px', fontSize:'0.75rem', fontWeight:700 }}>{agentiSez.length}</span>
        </div>
        {agentiSez.length===0 && <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.78rem', padding:'0.5rem', fontStyle:'italic' }}>Nessun collaboratore assegnato</div>}
        {agentiSez.map(ag => {
          const d = datiAgenti[ag.id]||{};
          const segs = getSegmenti(d);
          const seg = segs.find(s=>s.area===area.id) || {};
          const hasSplit = segs.length > 1;
          return (
            <button key={ag.id} onClick={()=>setModaleAgente(ag.id)}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:area.light, border:`1px solid ${area.border}`, borderRadius:12, padding:'0.8rem 1rem', marginBottom:4, cursor:'pointer' }}>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontWeight:600, color:'#111827', fontSize:'0.9rem' }}>
                  {ag.nome}
                  {hasSplit && <span style={{ background:'#e0e7ff', color:'#4338ca', fontSize:'0.62rem', padding:'1px 6px', borderRadius:99, fontWeight:700, marginLeft:6 }}>SPLIT</span>}
                </div>
                {area.id!=='ASS'&&seg.inizio && <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:1 }}>{seg.inizio}–{seg.fine} · p.{seg.pausa ?? 0}'</div>}
                {area.id==='ASS' && <div style={{ fontSize:'0.72rem', color:'#dc2626', marginTop:1 }}>{d.nota||'Assente'}</div>}
                {d.nota&&area.id!=='ASS' && <div style={{ fontSize:'0.7rem', color:'#9ca3af', marginTop:1 }}>📝 {d.nota}</div>}
              </div>
              <span style={{ color:'#9ca3af', fontSize:'1.2rem' }}>›</span>
            </button>
          );
        })}
        <textarea value={osservazioni[area.id]||''} onChange={e=>setOsservazioni(p=>({...p,[area.id]:e.target.value}))}
          placeholder={`Lavoro svolto presso ${area.nome}…`} rows={2}
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
        {/* Banner bozza ripristinata */}
        {bozzaBanner && !inviato && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:'0.7rem 0.9rem', marginBottom:'0.75rem' }}>
            <span style={{ fontSize:'1.15rem' }}>💾</span>
            <div style={{ flex:1, fontSize:'0.78rem', color:'#1e40af', lineHeight:1.3 }}>
              <div style={{ fontWeight:700 }}>Bozza ripristinata</div>
              <div style={{ opacity:0.8, fontSize:'0.72rem' }}>Salvata automaticamente {new Date(bozzaBanner.ts).toLocaleString('it-IT',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</div>
            </div>
            <button onClick={()=>{ if(window.confirm('Scartare la bozza e ricominciare da zero?')) scartaBozza(); }}
              style={{ background:'#fff', border:'1px solid #bfdbfe', color:'#1e40af', borderRadius:8, padding:'4px 10px', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>
              Scarta
            </button>
            <button onClick={()=>setBozzaBanner(null)}
              style={{ background:'transparent', border:'none', color:'#1e40af', fontSize:'1.1rem', fontWeight:700, cursor:'pointer', padding:'0 4px' }}>×</button>
          </div>
        )}
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
        {/* Sezioni legacy (es. Glassfloor): mostrate solo se ci sono agenti assegnati */}
        {AREE_LEGACY.filter(a=>agenti.some(ag=>getSegmenti(datiAgenti[ag.id]).some(s=>s.area===a.id))).map(a=>renderSezione(a))}

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
          <div>
            <div style={{ background:'#fff7ed', border:`2px solid ${ORANGE}`, borderRadius:14, padding:'0.9rem 1rem', marginBottom:12, textAlign:'center' }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:ORANGE_DARK, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Stai inviando il rapporto del</div>
              <div style={{ fontSize:'1.05rem', fontWeight:900, color:'#111827' }}>{fmtDateLong(dataOggi)}</div>
              <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:4 }}>Se la data è sbagliata, annulla e seleziona il giorno corretto dalla vista Settimana.</div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConferma(false)} style={{ flex:1, padding:'1rem', borderRadius:16, border:'2px solid #d1d5db', background:'#fff', color:'#374151', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>Annulla</button>
              <button onClick={doInvia} disabled={salvando}
                style={{ flex:1, padding:'1rem', borderRadius:16, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', opacity:salvando?0.7:1 }}>
                {salvando?'Invio…':'✓ Conferma'}
              </button>
            </div>
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
              if(nonAss.length>0){alert(`Ci sono ${nonAss.length} collaboratori non ancora assegnati. Assegnali prima di inviare.`);return;}
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
          onScegli={ag=>{setAgenti(p=>[...p,{id:ag.id,nome:ag.name,extra:true}]);setDatiAgenti(p=>({...p,[ag.id]:{inizio:'07:00',fine:'17:00',pausa:'30',...(p[ag.id]||{})}}));setPicker(false);setTimeout(()=>setModaleAgente(ag.id),120);}}
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
            <span style={{background:nomi.length>0?(mancante?'#fef2f2':'#fff7ed'):'#f3f4f6',color:nomi.length>0?(mancante?'#dc2626':ORANGE_DARK):'#9ca3af',borderRadius:99,padding:'3px 12px',fontSize:'0.78rem',fontWeight:700}}>{nomi.length} col.</span>
            {mancante&&<span style={{color:'#dc2626'}}>›</span>}
          </div>
        </div>
        {nomi.length>0?(
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{nomi.map(n=><span key={n} style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'2px 8px',fontSize:'0.7rem',color:'#374151'}}>{n}</span>)}</div>
        ):<div style={{fontSize:'0.78rem',color:'#9ca3af',fontStyle:'italic'}}>Nessun collaboratore pianificato</div>}
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
  const [showSezPicker,setShowSezPicker]=useState(false);
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
  const aree=[...AREE_TUTTE,...lavRpt.map(l=>({...LS_BASE,id:`LS_a${l.id}`,nome:l.nome}))];
  // Raggruppa entries per agent per gestire i turni SPLIT (piu' righe stesso agent_id)
  const _agByKey = {}; const datiRpt = {};
  entries.forEach(e => {
    const key = e.agent_id || `x_${e.id}`;
    if (!_agByKey[key]) _agByKey[key] = { id:key, nome:e.agent_name };
    if (!datiRpt[key]) datiRpt[key] = { segmenti: [], nota: '' };
    datiRpt[key].segmenti.push({ area:e.area, inizio:e.inizio, fine:e.fine, pausa:e.pausa });
    if (e.nota && !datiRpt[key].nota) datiRpt[key].nota = e.nota;
  });
  // Compatta i single-segmento nel formato piatto (retrocompatibile con codice esistente)
  Object.keys(datiRpt).forEach(k => {
    if (datiRpt[k].segmenti.length === 1) {
      const s = datiRpt[k].segmenti[0];
      datiRpt[k] = { area:s.area, inizio:s.inizio, fine:s.fine, pausa:s.pausa, nota:datiRpt[k].nota };
    }
  });
  const agentiRpt = Object.values(_agByKey);
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
                    <span style={{color:'#9ca3af'}}>{rv.num_agenti?`${rv.num_agenti} col.`:''}{rv.total_ore?` · ${parseFloat(rv.total_ore).toFixed(2)}h`:''}</span>
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
            if(ids.length===0){alert('Nessuna sezione con dati.');return;}
            setShowSezPicker(true);
          }} style={{flex:1,padding:'0.7rem',borderRadius:12,border:'none',background:'#16a34a',color:'#fff',fontWeight:700,fontSize:'0.8rem',cursor:'pointer'}}>
            📤 PDF Sezione
          </button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'0.75rem 1rem 2rem'}}>
          {loading?(<div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div style={{width:36,height:36,border:`3px solid ${ORANGE}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>):(
            aree.map(area=>{
              const agSez=entries.filter(e=>e.area===area.id).sort((a,b)=>(a.agent_name||'').localeCompare(b.agent_name||'','it'));
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

      {showSezPicker && (() => {
        const sezioniDisponibili = aree.filter(a=>{const s=entries.filter(e=>e.area===a.id);return s.length>0;});
        return (
          <div onClick={()=>setShowSezPicker(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:60,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
            <div onClick={ev=>ev.stopPropagation()} style={{background:'#fff',borderRadius:'24px 24px 0 0',width:'100%',maxWidth:520,maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
              <div style={{padding:'1.25rem 1.25rem 0.5rem',borderBottom:'1px solid #f3f4f6'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontWeight:800,color:'#111827'}}>📤 Quale sezione?</div>
                    <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:2}}>Tocca per generare il PDF</div>
                  </div>
                  <button onClick={()=>setShowSezPicker(false)} style={{width:32,height:32,borderRadius:'50%',background:'#f3f4f6',border:'none',fontSize:'1.1rem',cursor:'pointer',fontWeight:700}}>×</button>
                </div>
              </div>
              <div style={{padding:'1rem',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                {sezioniDisponibili.map(area => {
                  const numAg = entries.filter(e=>e.area===area.id).length;
                  return (
                    <button key={area.id} onClick={()=>{
                      const agSez=agentiRpt.filter(a=>getSegmenti(datiRpt[a.id]).some(s=>s.area===area.id));
                      apriPdfRapporto(area,agSez.map(a=>{
                        const seg=getSegmenti(datiRpt[a.id]).find(s=>s.area===area.id)||{};
                        return {nome:a.nome,area:area.id,inizio:seg.inizio,fine:seg.fine,pausa:seg.pausa,nota:datiRpt[a.id]?.nota};
                      }),ossRpt[area.id]||'',report.date);
                      setShowSezPicker(false);
                    }} style={{padding:'1rem 1.1rem',borderRadius:14,border:`2px solid ${area.bg||'#e5e7eb'}`,background:area.light||'#fff',color:'#111827',fontWeight:700,fontSize:'0.95rem',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                      <span>{area.emoji} {area.nome}</span>
                      <span style={{fontSize:'0.75rem',color:'#6b7280',fontWeight:600}}>{numAg} collaboratori</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── MODALE ESPORTA PERIODO ────────────────────────────────────────────────────
function ModalePeriodo({ reports, onChiudi }) {
  const oggi = todayIso();
  const oggiD = new Date(oggi+'T12:00:00');
  const setteFa = new Date(oggiD); setteFa.setDate(oggiD.getDate()-6);
  const trentaFa = new Date(oggiD); trentaFa.setDate(oggiD.getDate()-29);

  const [tipo, setTipo] = useState('generale'); // 'generale' o 'sezione'
  const [areaFiltro, setAreaFiltro] = useState(null);
  const [dataDa, setDataDa] = useState(isoDate(setteFa));
  const [dataA, setDataA] = useState(oggi);
  const [busy, setBusy] = useState(false);

  // Aree per l'export periodo — include storiche (Glassfloor) per non nascondere rapporti passati.
  const aree = AREE_TUTTE.filter(a=>a.id!=='ASS');

  const applicaPreset = (preset) => {
    const o = new Date(oggi+'T12:00:00');
    let da;
    if (preset==='week') { da = new Date(o); da.setDate(o.getDate()-6); }
    else if (preset==='month') { da = new Date(o); da.setDate(o.getDate()-29); }
    else if (preset==='year') { da = new Date(o); da.setFullYear(o.getFullYear()-1); }
    else if (preset==='all') { da = new Date('2020-01-01'); }
    setDataDa(isoDate(da));
    setDataA(oggi);
  };

  const reportsInPeriodo = reports.filter(r => r.date >= dataDa && r.date <= dataA);

  const genera = async () => {
    if (tipo==='sezione' && !areaFiltro) {
      alert('Seleziona una sezione');
      return;
    }
    setBusy(true);
    try {
      await apriPdfPeriodo(reportsInPeriodo, tipo, areaFiltro, dataDa, dataA);
      onChiudi();
    } catch(e) { console.error(e); }
    setBusy(false);
  };

  const presetBtn = (label, key) => (
    <button onClick={()=>applicaPreset(key)}
      style={{ flex:1, padding:'0.6rem 0.4rem', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:700, fontSize:'0.78rem', cursor:'pointer' }}>
      {label}
    </button>
  );

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div style={{background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 1.25rem 0.75rem',borderBottom:'1px solid #f3f4f6',flexShrink:0}}>
          <div>
            <div style={{fontWeight:800,color:'#111827'}}>📊 Esporta periodo</div>
            <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:2}}>Genera un PDF con tutti i rapporti del periodo</div>
          </div>
          <button onClick={onChiudi} style={{width:36,height:36,borderRadius:'50%',background:'#f3f4f6',border:'none',fontSize:'1.3rem',cursor:'pointer',fontWeight:700}}>×</button>
        </div>

        <div style={{padding:'1rem 1.25rem',overflowY:'auto',flex:1}}>

          {/* Tipo */}
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Tipo di rapporto</div>
          <div style={{ display:'flex', gap:8, marginBottom:18 }}>
            <button onClick={()=>{setTipo('generale');setAreaFiltro(null);}}
              style={{ flex:1, padding:'0.7rem', borderRadius:12, border:'2px solid '+(tipo==='generale'?ORANGE:'#e5e7eb'), background:tipo==='generale'?'#fff7ed':'#fff', color:tipo==='generale'?ORANGE_DARK:'#374151', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
              📄 PDF Generale
            </button>
            <button onClick={()=>setTipo('sezione')}
              style={{ flex:1, padding:'0.7rem', borderRadius:12, border:'2px solid '+(tipo==='sezione'?ORANGE:'#e5e7eb'), background:tipo==='sezione'?'#fff7ed':'#fff', color:tipo==='sezione'?ORANGE_DARK:'#374151', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
              📤 PDF Sezione
            </button>
          </div>

          {/* Sezione (solo se tipo=sezione) */}
          {tipo==='sezione' && (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Sezione</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {aree.map(a => (
                  <button key={a.id} onClick={()=>setAreaFiltro(a)}
                    style={{ padding:'0.5rem 0.8rem', borderRadius:99, border:'2px solid '+(areaFiltro?.id===a.id?a.bg:'#e5e7eb'), background:areaFiltro?.id===a.id?a.bg:'#fff', color:areaFiltro?.id===a.id?'#fff':'#374151', fontWeight:700, fontSize:'0.78rem', cursor:'pointer' }}>
                    {a.emoji} {a.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset rapidi */}
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Preset rapidi</div>
          <div style={{ display:'flex', gap:6, marginBottom:18 }}>
            {presetBtn('Settimana','week')}
            {presetBtn('Mese','month')}
            {presetBtn('Anno','year')}
            {presetBtn('Tutto','all')}
          </div>

          {/* Date custom */}
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Date custom</div>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginBottom:4 }}>Da</div>
              <input type="date" value={dataDa} max={dataA} onChange={e=>setDataDa(e.target.value)}
                style={{ width:'100%', padding:'0.6rem', borderRadius:10, border:'1px solid #e5e7eb', fontSize:'0.9rem', fontFamily:'inherit' }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginBottom:4 }}>A</div>
              <input type="date" value={dataA} min={dataDa} max={oggi} onChange={e=>setDataA(e.target.value)}
                style={{ width:'100%', padding:'0.6rem', borderRadius:10, border:'1px solid #e5e7eb', fontSize:'0.9rem', fontFamily:'inherit' }}/>
            </div>
          </div>

          {/* Conteggio */}
          <div style={{ background:reportsInPeriodo.length>0?'#f0fdf4':'#fef2f2', border:`1px solid ${reportsInPeriodo.length>0?'#bbf7d0':'#fecaca'}`, borderRadius:10, padding:'0.7rem 0.9rem', fontSize:'0.82rem', color:reportsInPeriodo.length>0?'#16a34a':'#dc2626', fontWeight:600 }}>
            {reportsInPeriodo.length>0
              ? `✓ ${reportsInPeriodo.length} rapport${reportsInPeriodo.length===1?'o':'i'} nel periodo selezionato`
              : '⚠️ Nessun rapporto nel periodo selezionato'}
          </div>
        </div>

        <div style={{ padding:'1rem 1.25rem', borderTop:'1px solid #f3f4f6', flexShrink:0 }}>
          <button onClick={genera} disabled={busy || reportsInPeriodo.length===0 || (tipo==='sezione' && !areaFiltro)}
            style={{ width:'100%', padding:'0.9rem', borderRadius:14, border:'none', background:(busy||reportsInPeriodo.length===0||(tipo==='sezione'&&!areaFiltro))?'#e5e7eb':ORANGE, color:'#fff', fontWeight:800, fontSize:'0.95rem', cursor:(busy||reportsInPeriodo.length===0)?'not-allowed':'pointer' }}>
            {busy ? 'Generazione in corso...' : '📊 Genera ed esporta PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VISTA ARCHIVIO ────────────────────────────────────────────────────────────
// ── MODALE STATISTICHE COLLABORATORI ─────────────────────────────────────────
function ModaleStatsCollaboratori({ reports, onChiudi }) {
  const oggi = todayIso();
  const oggiD = new Date(oggi + 'T12:00:00');

  // Elenco dei mesi/anni presenti nell'archivio (sorted desc: piu' recente primo).
  const mesiDisponibili = (() => {
    const set = new Set();
    reports.forEach(r => {
      const d = new Date(r.date + 'T12:00:00');
      set.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`);
    });
    const keyCorrente = `${oggiD.getFullYear()}-${String(oggiD.getMonth()).padStart(2,'0')}`;
    set.add(keyCorrente); // mese corrente sempre visibile anche se ancora senza rapporti
    return [...set].sort((a,b)=>b.localeCompare(a)).map(key => {
      const [y,m] = key.split('-').map(Number);
      return { key, y, m, label:`${MONTH_NAMES[m]} ${y}` };
    });
  })();

  const meseKeyCorrente = `${oggiD.getFullYear()}-${String(oggiD.getMonth()).padStart(2,'0')}`;
  const idxCorrente = Math.max(0, mesiDisponibili.findIndex(m => m.key === meseKeyCorrente));
  const [meseIdx, setMeseIdx] = useState(idxCorrente);
  const [tuttoArchivio, setTuttoArchivio] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const { dataDa, dataA, label } = (() => {
    if (tuttoArchivio) return { dataDa: '2020-01-01', dataA: oggi, label: 'Tutto l\'archivio' };
    const m = mesiDisponibili[meseIdx];
    if (!m) return { dataDa: '2020-01-01', dataA: oggi, label: 'Nessun rapporto' };
    const primo = new Date(m.y, m.m, 1);
    const ultimo = new Date(m.y, m.m+1, 0);
    return { dataDa: isoDate(primo), dataA: isoDate(ultimo), label: `${MONTH_NAMES[m.m]} ${m.y}` };
  })();

  // Fetch batch di tutte le entries dei rapporti in archivio: un'unica query,
  // poi filtriamo client-side ogni volta che cambia il periodo.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (reports.length === 0) { setEntries([]); setLoading(false); return; }
        const c = await sb();
        const ids = reports.map(r=>r.id);
        const { data } = await c.from('hrs_report_entries').select('*').in('report_id', ids);
        if (alive) setEntries(data||[]);
      } catch(e) { console.error('Stats load:', e); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [reports]);

  // Aggregazione filtrata per periodo: ore/giorni/breakdown per area per ogni collaboratore.
  const reportDateById = Object.fromEntries(reports.map(r=>[r.id, r.date]));
  const stats = (() => {
    const idsInPeriodo = new Set(reports.filter(r => r.date >= dataDa && r.date <= dataA).map(r=>r.id));
    const filtered = entries.filter(e => idsInPeriodo.has(e.report_id));
    const map = {};
    filtered.forEach(e => {
      if (e.area === 'ASS') return;
      const key = e.agent_id || `manuale:${e.agent_name}`;
      if (!map[key]) map[key] = { key, nome: e.agent_name, oreTot: 0, giorni: new Set(), byArea: {} };
      const ore = calcOre(e.inizio, e.fine, e.pausa);
      map[key].oreTot += ore;
      const date = reportDateById[e.report_id];
      if (date) map[key].giorni.add(date);
      if (!map[key].byArea[e.area]) map[key].byArea[e.area] = { ore: 0, giorni: new Set() };
      map[key].byArea[e.area].ore += ore;
      if (date) map[key].byArea[e.area].giorni.add(date);
    });
    return Object.values(map)
      .map(s => ({ ...s, giorni: s.giorni.size, byArea: Object.fromEntries(Object.entries(s.byArea).map(([a,v])=>[a,{ore:v.ore, giorni:v.giorni.size}])) }))
      .sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','it'));
  })();

  const totOre = stats.reduce((t,s)=>t+s.oreTot, 0);
  const oreMax = Math.max(1, ...stats.map(s=>s.oreTot));

  const puoIndietro = !tuttoArchivio && meseIdx < mesiDisponibili.length - 1;
  const puoAvanti = !tuttoArchivio && meseIdx > 0;
  const goIndietro = () => { setTuttoArchivio(false); setMeseIdx(i => Math.min(i+1, mesiDisponibili.length-1)); };
  const goAvanti   = () => { setTuttoArchivio(false); setMeseIdx(i => Math.max(i-1, 0)); };

  const areaMeta = id => AREE_TUTTE.find(a=>a.id===id) || (id?.startsWith('LS_') ? {...LS_BASE, id, nome:id} : {id, nome:id, bg:'#9ca3af', light:'#f3f4f6', border:'#e5e7eb'});

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'1.25rem 1.25rem 0.75rem', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:800, color:'#111827', fontSize:'1.05rem' }}>📊 Statistiche collaboratori</div>
              <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:2 }}>{label} · {stats.length} coll. · {totOre.toFixed(2)}h totali</div>
            </div>
            <button onClick={onChiudi} style={{ width:36, height:36, borderRadius:'50%', background:'#f3f4f6', border:'none', fontSize:'1.3rem', cursor:'pointer', fontWeight:700 }}>×</button>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:12, alignItems:'center' }}>
            <button onClick={goIndietro} disabled={!puoIndietro}
              style={{ width:38, height:38, borderRadius:10, border:'1px solid #e5e7eb', background:puoIndietro?'#fff':'#f9fafb', color:puoIndietro?'#111827':'#d1d5db', fontWeight:800, fontSize:'1rem', cursor:puoIndietro?'pointer':'not-allowed', flexShrink:0 }}>←</button>
            <div style={{ flex:1, textAlign:'center', padding:'0.55rem 0.4rem', borderRadius:10, border:!tuttoArchivio?'2px solid '+ORANGE:'1px solid #e5e7eb', background:!tuttoArchivio?'#fff7ed':'#fff', color:!tuttoArchivio?ORANGE_DARK:'#374151', fontWeight:800, fontSize:'0.85rem', cursor:'default', minHeight:38, display:'flex', alignItems:'center', justifyContent:'center', textTransform:'capitalize' }}>
              {tuttoArchivio ? 'Tutto' : (mesiDisponibili[meseIdx]?.label || '—')}
            </div>
            <button onClick={goAvanti} disabled={!puoAvanti}
              style={{ width:38, height:38, borderRadius:10, border:'1px solid #e5e7eb', background:puoAvanti?'#fff':'#f9fafb', color:puoAvanti?'#111827':'#d1d5db', fontWeight:800, fontSize:'1rem', cursor:puoAvanti?'pointer':'not-allowed', flexShrink:0 }}>→</button>
            <button onClick={()=>setTuttoArchivio(v=>!v)}
              style={{ padding:'0 0.75rem', height:38, borderRadius:10, border:tuttoArchivio?'2px solid '+ORANGE:'1px solid #e5e7eb', background:tuttoArchivio?'#fff7ed':'#fff', color:tuttoArchivio?ORANGE_DARK:'#374151', fontWeight:700, fontSize:'0.72rem', cursor:'pointer', flexShrink:0 }}>
              Tutto
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'0.75rem 1rem 1.5rem' }}>
          {loading && <div style={{ textAlign:'center', color:'#9ca3af', padding:'2rem', fontSize:'0.85rem' }}>Caricamento…</div>}
          {!loading && stats.length === 0 && <div style={{ textAlign:'center', color:'#9ca3af', padding:'2rem', fontSize:'0.85rem', fontStyle:'italic' }}>Nessun dato per il periodo selezionato</div>}
          {!loading && stats.map((s, i) => {
            const barPct = (s.oreTot / oreMax) * 100;
            return (
              <div key={s.key} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'0.75rem 0.9rem', marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                    <span style={{ background:'#f3f4f6', color:'#6b7280', borderRadius:6, padding:'2px 7px', fontSize:'0.68rem', fontWeight:800, minWidth:22, textAlign:'center' }}>{i+1}</span>
                    <div style={{ fontWeight:700, color:'#111827', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nome}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                    <div style={{ fontWeight:800, color:ORANGE_DARK, fontSize:'0.95rem' }}>{s.oreTot.toFixed(2)}h</div>
                    <div style={{ fontSize:'0.68rem', color:'#9ca3af' }}>{s.giorni} giorni</div>
                  </div>
                </div>
                <div style={{ height:4, background:'#f3f4f6', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ height:'100%', background:ORANGE, width:`${barPct}%`, transition:'width 0.3s' }}/>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {Object.entries(s.byArea).sort((a,b)=>b[1].ore-a[1].ore).map(([areaId, v]) => {
                    const m = areaMeta(areaId);
                    return (
                      <span key={areaId} style={{ background:m.light, border:`1px solid ${m.border}`, color:'#374151', borderRadius:8, padding:'2px 7px', fontSize:'0.68rem', fontWeight:700 }}>
                        {m.emoji||''} {m.label||m.nome}: <b>{v.ore.toFixed(1)}h</b> · {v.giorni}g
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VistaArchivio({ reports, onSelectDate }) {
  const [reportSel,setReportSel]=useState(null);
  const [showPeriodo,setShowPeriodo]=useState(false);
  const [showStats,setShowStats]=useState(false);
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
      {reports.length>0 && (
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <button onClick={()=>setShowPeriodo(true)}
            style={{ flex:1, padding:'0.85rem 0.6rem', borderRadius:14, border:`2px solid ${ORANGE}`, background:'#fff7ed', color:ORANGE_DARK, fontWeight:800, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            📊 Esporta periodo
          </button>
          <button onClick={()=>setShowStats(true)}
            style={{ flex:1, padding:'0.85rem 0.6rem', borderRadius:14, border:`2px solid #4f46e5`, background:'#eef2ff', color:'#4338ca', fontWeight:800, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            👥 Stats coll.
          </button>
        </div>
      )}
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
      {showPeriodo&&<ModalePeriodo reports={reports} onChiudi={()=>setShowPeriodo(false)}/>}
      {showStats&&<ModaleStatsCollaboratori reports={reports} onChiudi={()=>setShowStats(false)}/>}
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
          <div style={{ fontSize:'0.78rem', color:'#9ca3af', fontStyle:'italic' }}>Nessun collaboratore pianificato</div>
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
    const aree = [...AREE_TUTTE, ...se.filter(s=>s.area.startsWith('LS_')).map(s=>({...LS_BASE, id:s.area, nome:s.lavorazione_nome||s.area}))];
    const totOreGiornata = en.filter(e=>e.area!=='ASS').reduce((t,e)=>t+calcOre(e.inizio,e.fine,e.pausa),0);
    return (
      <div style={{ padding:'1rem', paddingBottom:120 }}>
        {/* Header rapporto */}
        <div style={{ background:'#fff', border:'1px solid #f3f4f6', borderRadius:16, padding:'1rem', marginBottom:'1rem' }}>
          <div style={{ fontWeight:800, color:'#111827', marginBottom:4 }}>{fmtDateLong(r.date)}</div>
          <div style={{ fontSize:'0.78rem', color:'#9ca3af' }}>
            Inviato {oT(r.submitted_at)} · {en.length} collaboratori · v{r.version||1}
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
                  <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:3 }}>Lavoro svolto</div>
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

// ── MODALE CHANGELOG (Novita' in HRS) ────────────────────────────────────────
const CHANGELOG_TYPE_META = {
  feature:     { color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', label:'novita\'' },
  improvement: { color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', label:'miglioramento' },
  fix:         { color:'#d97706', bg:'#fffbeb', border:'#fde68a', label:'correzione' },
  notice:      { color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', label:'avviso' },
};
function ModaleChangelog({ entries, readIds, onMarkRead, onMarkAllRead, onChiudi }) {
  const nonLette = entries.filter(e => !readIds.has(e.id));
  const fmtEntryDate = iso => {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };
  return (
    <div onClick={onChiudi}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', justifyContent:'center', alignItems:'flex-start', padding:'8vh 16px 16px', overflowY:'auto' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'84vh' }}>
        <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'Barlow Condensed, Impact, sans-serif', fontWeight:900, fontSize:'1.35rem', letterSpacing:'0.04em', color:'#111827', textTransform:'uppercase' }}>✨ Novita' in HRS</div>
            <div style={{ fontSize:'0.7rem', color:'#6b7280', marginTop:2 }}>{entries.length} aggiornamenti · {nonLette.length} da leggere</div>
          </div>
          <button onClick={onChiudi} style={{ width:36, height:36, borderRadius:'50%', background:'#f3f4f6', border:'none', fontSize:'1.3rem', cursor:'pointer', fontWeight:700 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem' }}>
          {entries.length === 0 && (
            <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.9rem', padding:'2rem 0', fontStyle:'italic' }}>Nessuna novita' al momento.</div>
          )}
          {entries.map(e => {
            const meta = CHANGELOG_TYPE_META[e.type] || CHANGELOG_TYPE_META.notice;
            const isNew = !readIds.has(e.id);
            return (
              <div key={e.id}
                style={{ borderLeft:`4px solid ${meta.color}`, background:isNew?meta.bg:'#fafafa', border:`1px solid ${isNew?meta.border:'#e5e7eb'}`, borderRadius:10, padding:'0.85rem 1rem', marginBottom:10, position:'relative' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:'1.15rem', lineHeight:1 }}>{e.icon || '•'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, color:'#111827', fontSize:'0.95rem' }}>{e.title}</span>
                      <span style={{ background:meta.color, color:'#fff', fontSize:'0.62rem', padding:'2px 7px', borderRadius:99, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.04em' }}>{meta.label}</span>
                      {isNew && <span style={{ background:'#dc2626', color:'#fff', fontSize:'0.6rem', padding:'2px 7px', borderRadius:99, fontWeight:800, letterSpacing:'0.04em' }}>NUOVO</span>}
                    </div>
                    <div style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#9ca3af', marginTop:2 }}>{fmtEntryDate(e.entry_date)}</div>
                  </div>
                </div>
                {e.description && (
                  <div style={{ fontSize:'0.85rem', color:'#374151', lineHeight:1.5, whiteSpace:'pre-wrap', marginTop:6 }}>{e.description}</div>
                )}
                {isNew && (
                  <button onClick={()=>onMarkRead(e.id)}
                    style={{ marginTop:8, background:'#fff', border:`1px solid ${meta.color}`, color:meta.color, borderRadius:8, padding:'4px 10px', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>
                    ✓ Segna come letta
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {nonLette.length > 0 && (
          <div style={{ padding:'0.75rem 1.25rem', borderTop:'1px solid #e5e7eb', flexShrink:0 }}>
            <button onClick={onMarkAllRead}
              style={{ width:'100%', padding:'0.7rem', borderRadius:12, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:'0.85rem', cursor:'pointer' }}>
              ✓ Segna tutte come lette ({nonLette.length})
            </button>
          </div>
        )}
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
  const [notifica, setNotifica]       = useState(null);
  const notificaTimerRef              = useRef(null);
  const seenShiftIdsRef               = useRef(new Set());
  const [quoteIndex, setQuoteIndex]   = useState(() => getQuoteIndexForToday());
  const [changelog, setChangelog]     = useState([]);
  const [changelogReadIds, setChangelogReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CHANGELOG_LS_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [changelogOpen, setChangelogOpen] = useState(false);

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
        const idsInLista=new Set(nuoviAgenti.map(a=>a.id));
        // Raggruppa le entries per agent_id per rilevare i turni SPLIT (piu' righe stesso agente).
        const entriesByAgent = {};
        const extraManuali = [];
        (entries||[]).forEach(e=>{
          if (e.agent_id) {
            if (!entriesByAgent[e.agent_id]) entriesByAgent[e.agent_id] = [];
            entriesByAgent[e.agent_id].push(e);
          } else {
            extraManuali.push(e);
          }
        });
        Object.entries(entriesByAgent).forEach(([aid, ents])=>{
          const sorted = ents.sort((a,b)=>String(a.inizio||'').localeCompare(String(b.inizio||'')));
          const primoNota = sorted.find(e=>e.nota)?.nota || '';
          if (sorted.length === 1) {
            const e = sorted[0];
            const _ini = e.inizio || (e.area==='ASS'?null:'07:00');
            const _fin = e.fine   || (e.area==='ASS'?null:'17:00');
            nuoviDati[aid] = { area:e.area, inizio:_ini, fine:_fin, pausa:String(e.pausa ?? 30), nota:primoNota };
          } else {
            // Turno spezzato: formato segmenti
            nuoviDati[aid] = {
              segmenti: sorted.map(e => ({
                area: e.area,
                inizio: e.inizio || '07:00',
                fine: e.fine || '12:00',
                pausa: String(e.pausa ?? 0),
              })),
              nota: primoNota,
            };
          }
          if(!idsInLista.has(aid)){
            const ag = agMapRef?.[aid];
            nuoviAgenti.push({id:aid, nome:ag?.name||sorted[0].agent_name, extra:true, shift_inizio:null, shift_fine:null});
            idsInLista.add(aid);
          }
        });
        extraManuali.forEach(e=>{
          const xid=`extra_${e.id}`;
          const _ini = e.inizio || (e.area==='ASS'?null:'07:00');
          const _fin = e.fine   || (e.area==='ASS'?null:'17:00');
          nuoviAgenti.push({id:xid, nome:e.agent_name, extra:true});
          nuoviDati[xid] = { area:e.area, inizio:_ini, fine:_fin, pausa:String(e.pausa ?? 30), nota:e.nota||'' };
        });
        setAgentiOggi(nuoviAgenti); setDatiAgenti(nuoviDati);
        const nuoveOss={}; (sezioni||[]).forEach(s=>{nuoveOss[s.area]=s.osservazione;}); setOsservazioni(nuoveOss);
        // Ricostruisci le Lavorazioni Speciali (LS) dal DB: le entries/sections
        // hanno area='LS_<id>' e lavorazione_nome, ma la lista `lavorazioni` era
        // resettata a [] all'inizio. Senza questo, agenti+osservazioni assegnati
        // a una LS scompaiono dalla UI al ricarico.
        const lavRic=[]; const lavIds=new Set();
        const raccogliLS=(area,nome)=>{
          if(!area||!area.startsWith('LS_')||!nome)return;
          const rawId=area.slice(3);
          if(lavIds.has(rawId))return;
          lavIds.add(rawId);
          const numId=Number(rawId);
          lavRic.push({id:Number.isFinite(numId)?numId:rawId,nome});
        };
        (entries||[]).forEach(e=>raccogliLS(e.area,e.lavorazione_nome));
        (sezioni||[]).forEach(s=>raccogliLS(s.area,s.lavorazione_nome));
        if(lavRic.length>0)setLavorazioni(lavRic);
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

  // Carica la frase del giorno: check override in daily_phrase, altrimenti indice deterministico.
  useEffect(() => {
    if (!logged) return;
    let alive = true;
    (async () => {
      try {
        const c = await sb();
        const oggi = todayIso();
        const { data } = await c.from('daily_phrase').select('phrase').eq('date', oggi).limit(1);
        if (!alive) return;
        let idx = getQuoteIndexForToday();
        if (data && data[0] && data[0].phrase) {
          try {
            const parsed = JSON.parse(data[0].phrase);
            if (typeof parsed?.index === 'number' && parsed.index >= 0 && parsed.index < QUOTES.length) idx = parsed.index;
          } catch {}
        }
        setQuoteIndex(idx);
      } catch (e) { console.warn('Quote load:', e); }
    })();
    return () => { alive = false; };
  }, [logged]);

  // Carica le novita' (Changelog HRS) da Supabase — tabella hrs_changelog.
  useEffect(() => {
    if (!logged) return;
    let alive = true;
    (async () => {
      try {
        const c = await sb();
        const { data } = await c.from('hrs_changelog')
          .select('id, entry_date, title, description, type, icon, active, created_at')
          .eq('active', true)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20);
        if (alive && data) setChangelog(data);
      } catch (e) { console.warn('Changelog load:', e); }
    })();
    return () => { alive = false; };
  }, [logged]);

  const markChangelogRead = (id) => {
    setChangelogReadIds(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem(CHANGELOG_LS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const markAllChangelogRead = () => {
    setChangelogReadIds(prev => {
      const next = new Set(prev);
      changelog.forEach(e => next.add(e.id));
      try { localStorage.setItem(CHANGELOG_LS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Subscription realtime: nuovi turni pianificati (INSERT su shifts) sui servizi HRS Stadio.
  // Mostra un toast a JAS e ricarica la vista se il turno cade sulla data attualmente aperta.
  useEffect(() => {
    if (!logged || ruolo !== 'jas' || hrsSvcIds.length === 0) return;
    let ch = null;
    let alive = true;
    (async () => {
      const c = await sb();
      const hrsIds = new Set(hrsSvcIds);
      ch = c.channel('hrs_shifts_new')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts' }, (payload) => {
          if (!alive) return;
          const s = payload.new;
          if (!s || !hrsIds.has(s.service_id)) return;
          if (seenShiftIdsRef.current.has(s.id)) return;
          seenShiftIdsRef.current.add(s.id);
          const nome = agMap[s.agent_id]?.name || s.agent_id || 'Collaboratore';
          const ora = s.start_time ? String(s.start_time).slice(0,5) : '';
          const fin = s.end_time ? String(s.end_time).slice(0,5) : '';
          const orario = ora ? ` · ${ora}${fin?`–${fin}`:''}` : '';
          setNotifica({ nome, data: s.date, testo: `${nome} · ${fmtDateLong(s.date)}${orario}` });
          if (notificaTimerRef.current) clearTimeout(notificaTimerRef.current);
          notificaTimerRef.current = setTimeout(() => setNotifica(null), 7000);
          // Se il turno cade sulla data che l'utente sta guardando, ricarica in background
          if (s.date === dataTarget) { caricaDataTarget(dataTarget, hrsSvcIds, agMap); }
        })
        .subscribe();
    })();
    return () => {
      alive = false;
      if (ch) { try { ch.unsubscribe(); } catch(e){} }
      if (notificaTimerRef.current) { clearTimeout(notificaTimerRef.current); notificaTimerRef.current = null; }
    };
  }, [logged, ruolo, hrsSvcIds, agMap, dataTarget, caricaDataTarget]);

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

  if (!logged) return <LoginScreen onLogin={r=>{
    setLogged(true);
    setRuolo(r);
    if (r === 'jas') {
      const ora = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      const dataOggi = fmtDateLong(todayIso());
      sendTelegram(`🔓 <b>JAS</b> ha effettuato l'accesso — ${dataOggi} · ${ora}`);
    }
  }}/>;

  const isPassato = dataTarget !== DATA_OGGI;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#f9fafb', maxWidth:520, margin:'0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes chPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style>

      {changelogOpen && (
        <ModaleChangelog entries={changelog} readIds={changelogReadIds}
          onMarkRead={markChangelogRead} onMarkAllRead={markAllChangelogRead}
          onChiudi={()=>setChangelogOpen(false)}/>
      )}

      {/* TOAST nuovo turno pianificato (JAS) */}
      {notifica && (
        <div onClick={()=>{ if(notifica?.data && notifica.data!==dataTarget){ handleSelectDate(notifica.data); } setNotifica(null); }}
          style={{ position:'fixed', top:12, left:12, right:12, maxWidth:496, margin:'0 auto', background:'#2563eb', color:'#fff', padding:'0.85rem 1rem', borderRadius:14, zIndex:200, boxShadow:'0 8px 24px rgba(37,99,235,0.35)', display:'flex', alignItems:'center', gap:10, cursor:'pointer', animation:'slideDown 0.25s ease-out' }}>
          <span style={{ fontSize:'1.4rem' }}>📅</span>
          <div style={{ flex:1, fontSize:'0.85rem', lineHeight:1.35 }}>
            <div style={{ fontWeight:800, marginBottom:1 }}>Nuovo turno pianificato</div>
            <div style={{ opacity:0.95 }}>{notifica.testo}</div>
          </div>
          <button onClick={(e)=>{ e.stopPropagation(); setNotifica(null); }}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:'1.1rem', cursor:'pointer', padding:'2px 8px', borderRadius:8, fontWeight:700 }}>×</button>
        </div>
      )}

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
            {(() => {
              const nonLette = changelog.filter(e => !changelogReadIds.has(e.id)).length;
              return (
                <button onClick={()=>setChangelogOpen(true)} title="Novita' in HRS"
                  style={{ position:'relative', width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', color:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                  ✨
                  {nonLette > 0 && (
                    <span style={{ position:'absolute', top:-4, right:-4, minWidth:18, height:18, padding:'0 5px', borderRadius:9, background:'#dc2626', color:'#fff', fontSize:'0.65rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.25)', animation:'chPulse 2s ease-in-out infinite' }}>
                      {nonLette}
                    </span>
                  )}
                </button>
              );
            })()}
            <button onClick={handleRefresh} disabled={refreshing} title="Aggiorna"
              style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', color:'#fff', cursor:refreshing?'wait':'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
              <span style={{ display:'inline-block', animation:refreshing?'spin 0.8s linear infinite':'none' }}>🔄</span>
            </button>
            <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'0.8rem' }}>
              {ruolo==='admin'?'ADM':'JAS'}
            </div>
          </div>
        </div>
        {/* FRASE DEL GIORNO — sincronizzata con PLAN */}
        {quoteIndex !== null && QUOTES[quoteIndex] && (
          <div style={{ background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:12, padding:'8px 12px', marginBottom:'0.65rem', textAlign:'center' }}>
            <div style={{ fontFamily:'Georgia, "Cormorant Garamond", serif', fontStyle:'italic', fontWeight:700, fontSize:'0.9rem', color:'#fff', lineHeight:1.35, letterSpacing:'0.01em', textShadow:'0 1px 1px rgba(0,0,0,0.08)' }}>
              "{QUOTES[quoteIndex][0]}"
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'0.62rem', fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:4, letterSpacing:'0.05em', textTransform:'uppercase' }}>
              — {QUOTES[quoteIndex][1]}
            </div>
          </div>
        )}
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
