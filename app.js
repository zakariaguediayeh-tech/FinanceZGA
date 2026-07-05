/* ============ MES FINANCES — app.js (v2) ============ */

/* Catégories (dépenses) */
const CATS = [
  {id:"alim", n:"Alimentation", e:"🛒", c:"#2dd4a7"},
  {id:"loge", n:"Logement",     e:"🏠", c:"#4d9ef6"},
  {id:"transp",n:"Transport",   e:"🚗", c:"#8b7cf6"},
  {id:"loisir",n:"Loisirs",     e:"🎮", c:"#f0b429"},
  {id:"sante", n:"Santé",       e:"⚕️", c:"#f4736b"},
  {id:"resto", n:"Restaurant",  e:"🍽️", c:"#fb923c"},
  {id:"shop",  n:"Shopping",    e:"🛍️", c:"#ec4899"},
  {id:"abo",   n:"Abonnements", e:"📱", c:"#22d3ee"},
  {id:"autre", n:"Autre",       e:"📦", c:"#94a3b8"},
];
const INCOME_CATS = [
  {id:"salaire",n:"Salaire", e:"💼", c:"#2dd4a7"},
  {id:"freelance",n:"Freelance",e:"💻",c:"#4d9ef6"},
  {id:"cadeau", n:"Cadeau",  e:"🎁", c:"#8b7cf6"},
  {id:"autre_in",n:"Autre",  e:"💰", c:"#94a3b8"},
];
const catById = id => CATS.find(c=>c.id===id) || INCOME_CATS.find(c=>c.id===id) || {n:"Autre",e:"📦",c:"#94a3b8"};

/* ============ ÉTAT + PERSISTANCE ============ */
const KEY  = "mesfinances_v2";
const KEY1 = "mesfinances_v1";
let DB = load();
let tab = "dash";
let txType = "expense";
let txCat = "alim";
let txEditId = null;
let txFilter = "";
let viewMonth = null;   // "YYYY-MM" affiché (initialisé dans boot)

function load(){
  try{
    const d = JSON.parse(localStorage.getItem(KEY));
    if(d) return fix(d);
  }catch(e){}
  // migration depuis v1 : on garde toutes les anciennes données
  try{
    const d1 = JSON.parse(localStorage.getItem(KEY1));
    if(d1){ const m = fix(d1); localStorage.setItem(KEY, JSON.stringify(m)); return m; }
  }catch(e){}
  return fix({});
}
function fix(d){
  d = d || {};
  d.tx = Array.isArray(d.tx)? d.tx : [];
  d.budgets = d.budgets || {};
  d.goals = Array.isArray(d.goals)? d.goals : [];
  d.settings = Object.assign({currency:"€", theme:"dark"}, d.settings||{});
  return d;
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){ toast("Erreur de sauvegarde !","err"); } }
function cur(){ return DB.settings.currency || "€"; }
const fmt  = n => (n<0?"-":"") + Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2}) + " " + cur();
const fmt2 = n => Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0});

/* ============ HELPERS DATE / CALCULS ============ */
function ym(d){ const x=new Date(d); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,'0'); }
function curMonth(){ return ym(new Date()); }
function addMonths(yms,delta){ const [y,m]=yms.split('-').map(Number); return ym(new Date(y, m-1+delta, 1)); }
const MONTHNAMES=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function monthLabel(yms){ const [y,m]=yms.split('-'); return MONTHNAMES[+m-1]+" "+y; }

function txOfMonth(yms){ return DB.tx.filter(t=>ym(t.date)===yms); }
function sumIncome(yms){ return txOfMonth(yms).filter(t=>t.type==="income").reduce((a,t)=>a+t.amount,0); }
function sumExpense(yms){ return txOfMonth(yms).filter(t=>t.type==="expense").reduce((a,t)=>a+t.amount,0); }
function spentByCat(yms,catId){ return txOfMonth(yms).filter(t=>t.type==="expense"&&t.cat===catId).reduce((a,t)=>a+t.amount,0); }

/* ============ NAVIGATION ENTRE MOIS ============ */
function shiftMonth(d){
  let nm = addMonths(viewMonth, d);
  if(nm > curMonth()) nm = curMonth();          // pas de futur
  viewMonth = nm; render();
}
function setMonth(m){ viewMonth = (m>curMonth())?curMonth():m; render(); }

/* ============ NAV ONGLETS ============ */
function go(t){
  tab=t;
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  document.getElementById("fab").style.display = (t==="invest"||t==="settings")?"none":"flex";
  render();
}
function toast(msg,type){
  const el=document.getElementById("toast");
  el.textContent=msg; el.className="toast show"+(type?(" "+type):"");
  clearTimeout(el._t); el._t=setTimeout(()=>el.className="toast",1700);
}

/* ============ RENDER ROUTER ============ */
function render(){
  document.getElementById("hdrMonth").textContent = monthLabel(viewMonth);
  const nx=document.getElementById("mnext");
  if(nx) nx.style.opacity = (viewMonth===curMonth())? ".35":"1";
  const subs={dash:"Tableau de bord",tx:"Transactions",budget:"Budgets & alertes",save:"Épargne & objectifs",invest:"Investir (éducatif)",settings:"Paramètres"};
  document.getElementById("hdrSub").textContent = subs[tab];
  const v=document.getElementById("view");
  v.innerHTML = ({dash:viewDash,tx:viewTx,budget:viewBudget,save:viewSave,invest:viewInvest,settings:viewSettings})[tab]();
  if(tab==="dash") drawDonut();
  if(tab==="invest") calcCI();
}

/* ============ VUE TABLEAU DE BORD ============ */
function viewDash(){
  const m=viewMonth, pm=addMonths(m,-1);
  const inc=sumIncome(m), exp=sumExpense(m), bal=inc-exp;
  const savingRate = inc>0 ? Math.round((bal/inc)*100) : 0;

  /* alertes budget (seulement pour le mois courant) */
  let alerts="";
  if(m===curMonth()) CATS.forEach(c=>{
    const b=DB.budgets[c.id]; if(!b) return;
    const s=spentByCat(m,c.id); const r=s/b;
    if(r>=1) alerts+=`<div class="alert danger">⛔ Budget <b>${c.n}</b> dépassé : ${fmt(s)} / ${fmt(b)}</div>`;
    else if(r>=0.8) alerts+=`<div class="alert">⚠️ Budget <b>${c.n}</b> presque atteint : ${fmt(s)} / ${fmt(b)} (${Math.round(r*100)}%)</div>`;
  });

  /* comparaison avec le mois précédent */
  const pInc=sumIncome(pm), pExp=sumExpense(pm), pBal=pInc-pExp;
  const catDelta = CATS.map(c=>({c, now:spentByCat(m,c.id), prev:spentByCat(pm,c.id)}))
    .map(x=>({c:x.c, now:x.now, prev:x.prev, d:x.now-x.prev}))
    .filter(x=>(x.now>0||x.prev>0) && x.d!==0)
    .sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,3);
  const catDeltaHtml = catDelta.length ? catDelta.map(x=>`
    <div class="row between" style="padding:5px 0;font-size:13px">
      <span>${x.c.e} ${x.c.n}</span>
      <span class="${x.d>0?'expense':'income'}" style="font-weight:700">${x.d>0?'▲ +':'▼ −'}${fmt(Math.abs(x.d))}</span>
    </div>`).join('')
    : `<div class="muted" style="font-size:12px;padding:4px 0">Pas de variation notable par catégorie.</div>`;

  /* graphe 12 derniers mois (revenus vs dépenses) */
  const months=[]; for(let i=11;i>=0;i--) months.push(addMonths(curMonth(),-i));
  const maxAbs=Math.max(1,...months.map(mm=>Math.max(sumIncome(mm),sumExpense(mm))));
  const bars=months.map(mm=>{
    const e=sumExpense(mm), i2=sumIncome(mm);
    const he=Math.max(2,e/maxAbs*100), hi=Math.max(2,i2/maxAbs*100);
    const on = mm===m;
    return `<div style="flex:1;min-width:34px;text-align:center;cursor:pointer;${on?'':'opacity:.62'}" onclick="setMonth('${mm}')">
      <div style="display:flex;gap:2px;align-items:flex-end;height:90px;justify-content:center">
        <div style="width:45%;max-width:14px;height:${hi}%;background:var(--income);border-radius:3px 3px 0 0"></div>
        <div style="width:45%;max-width:14px;height:${he}%;background:var(--expense);border-radius:3px 3px 0 0"></div>
      </div>
      <div class="barlbl" style="${on?'color:var(--txt);font-weight:800':''}">${MONTHNAMES[+mm.split('-')[1]-1].replace('.','')}</div>
    </div>`;
  }).join('');

  const recent = txOfMonth(m).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
  const recentHtml = recent.length ? recent.map(t=>`<div onclick="openTx('${t.id}')">${txRow(t)}</div>`).join('')
    : '<div class="empty">Aucune transaction ce mois-ci.<br>Appuie sur + pour commencer.</div>';

  return `<div class="wrap">
    ${alerts}
    <div class="card">
      <div class="muted">Solde du mois — ${monthLabel(m)}</div>
      <div class="big ${bal>=0?'income':'expense'}">${fmt(bal)}</div>
      <div class="grid2" style="margin-top:13px">
        <div class="stat"><div class="v income">${fmt(inc)}</div><div class="l">↓ Revenus ${cmpBadge(inc,pInc,false)}</div></div>
        <div class="stat"><div class="v expense">${fmt(exp)}</div><div class="l">↑ Dépenses ${cmpBadge(exp,pExp,true)}</div></div>
      </div>
      <div class="row between" style="margin-top:13px">
        <span class="muted">Taux d'épargne</span>
        <b class="${savingRate>=0?'income':'expense'}">${savingRate}%</b>
      </div>
      <div class="progwrap"><div class="progbar" style="width:${Math.max(0,Math.min(100,savingRate))}%;background:var(--income)"></div></div>
    </div>

    <div class="card">
      <b style="font-size:15px">Comparaison avec ${monthLabel(pm)}</b>
      <div style="margin-top:8px">
        ${cmpRow("Revenus", inc, pInc, false)}
        ${cmpRow("Dépenses", exp, pExp, true)}
        ${cmpRow("Solde", bal, pBal, false)}
      </div>
      <hr class="sep">
      <div class="muted" style="font-size:11px;margin-bottom:4px">Plus grandes variations par catégorie</div>
      ${catDeltaHtml}
    </div>

    <div class="card">
      <b style="font-size:15px">Répartition des dépenses</b>
      <div class="muted" style="font-size:11px;margin-bottom:6px">${monthLabel(m)}</div>
      <div id="donutWrap" style="text-align:center"></div>
    </div>

    <div class="card">
      <div class="row between">
        <b style="font-size:15px">Historique · 12 mois</b>
        <span style="font-size:11px;color:var(--muted)"><span class="dot" style="background:var(--income);display:inline-block;vertical-align:middle"></span> Rev. &nbsp;<span class="dot" style="background:var(--expense);display:inline-block;vertical-align:middle"></span> Dép.</span>
      </div>
      <div class="muted" style="font-size:11px;margin-top:3px">Appuie sur un mois pour le consulter</div>
      <div class="bars" style="height:auto;align-items:flex-end;overflow-x:auto">${bars}</div>
    </div>

    <div class="card">
      <div class="row between" style="margin-bottom:6px">
        <b style="font-size:15px">Transactions · ${monthLabel(m)}</b>
        <button class="del" style="color:var(--accent)" onclick="go('tx')">Tout voir →</button>
      </div>
      ${recentHtml}
    </div>
    <div style="height:10px"></div>
  </div>`;
}

function cmpBadge(now,prev,upIsBad){
  if(prev===0) return "";
  const d=now-prev; if(d===0) return "";
  const pct=Math.round(Math.abs(d)/prev*100);
  const good = upIsBad ? d<0 : d>0;
  return `<span class="${good?'income':'expense'}" style="font-weight:800">${d>0?'▲':'▼'}${pct}%</span>`;
}
function cmpRow(label, now, prev, upIsBad){
  const d=now-prev;
  const pct = prev!==0 ? Math.round(Math.abs(d)/Math.abs(prev)*100)+"%" : (now!==0?"nouveau":"—");
  const good = upIsBad ? d<=0 : d>=0;
  const cls = d===0 ? "muted" : (good?"income":"expense");
  return `<div class="row between" style="padding:5px 0;font-size:13.5px">
    <span class="muted">${label}</span>
    <span><b>${fmt(now)}</b> <span class="${cls}" style="font-size:12px;font-weight:800;margin-left:5px">${d===0?'＝':(d>0?'▲':'▼')} ${d===0?'':pct}</span></span>
  </div>`;
}

function drawDonut(){
  const m=viewMonth;
  const data=CATS.map(c=>({id:c.id,n:c.n,e:c.e,c:c.c,v:spentByCat(m,c.id)})).filter(d=>d.v>0).sort((a,b)=>b.v-a.v);
  const wrap=document.getElementById('donutWrap'); if(!wrap) return;
  const total=data.reduce((a,d)=>a+d.v,0);
  if(total===0){ wrap.innerHTML='<div class="empty">Pas de dépenses sur ce mois.</div>'; return; }
  const R=58, C=2*Math.PI*R; let off=0;
  const circles=data.map(d=>{
    const frac=d.v/total; const len=frac*C;
    const el=`<circle cx="80" cy="80" r="${R}" fill="none" stroke="${d.c}" stroke-width="22"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`;
    off+=len; return el;
  }).join('');
  const legend=data.map(d=>`<div class="li"><span class="dot" style="background:${d.c}"></span>
    <span style="flex:1">${d.e} ${d.n}</span><b>${fmt(d.v)}</b>
    <span class="muted" style="margin-left:6px">${Math.round(d.v/total*100)}%</span></div>`).join('');
  wrap.innerHTML=`<svg class="donut" width="160" height="160" viewBox="0 0 160 160">
    ${circles}
    <text x="80" y="74" text-anchor="middle" fill="var(--muted)" font-size="10">Total</text>
    <text x="80" y="92" text-anchor="middle" fill="var(--txt)" font-size="16" font-weight="800">${fmt2(total)}${cur()}</text>
  </svg><div class="legend">${legend}</div>`;
}

/* ============ VUE TRANSACTIONS ============ */
function txRow(t){
  const c=catById(t.cat);
  const sign=t.type==="income"?"+":"−";
  const cls=t.type==="income"?"income":"expense";
  return `<div class="tx">
    <div class="ic" style="background:${c.c}22;color:${c.c}">${c.e}</div>
    <div class="info"><div class="t">${esc(t.label)||c.n}</div>
      <div class="d">${c.n} · ${new Date(t.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'})}</div></div>
    <div class="amt ${cls}">${sign}${fmt(t.amount)}</div>
  </div>`;
}
function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function viewTx(){
  return `<div class="wrap">
    <div class="field" style="margin-bottom:10px">
      <input id="txSearch" type="search" placeholder="🔍 Rechercher (libellé ou catégorie)…" value="${esc(txFilter)}"
        oninput="txFilter=this.value;renderTxList()">
    </div>
    <div class="muted" style="font-size:12px;margin-bottom:10px;text-align:center">Astuce : appuie sur une transaction pour la modifier ou la supprimer</div>
    <div id="txList">${txListHtml()}</div>
    <div style="height:10px"></div></div>`;
}
function txListHtml(){
  const f=txFilter.trim().toLowerCase();
  let sorted=[...DB.tx].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(f) sorted=sorted.filter(t=>(t.label||"").toLowerCase().includes(f)||catById(t.cat).n.toLowerCase().includes(f));
  if(sorted.length===0) return '<div class="card"><div class="empty">'+(f?'Aucun résultat pour cette recherche.':'Aucune transaction.<br>Appuie sur le bouton + en bas à droite.')+'</div></div>';
  const groups={};
  sorted.forEach(t=>{ const k=ym(t.date); (groups[k]=groups[k]||[]).push(t); });
  let html="";
  for(const k of Object.keys(groups).sort().reverse()){
    const inc=groups[k].filter(t=>t.type==="income").reduce((a,t)=>a+t.amount,0);
    const exp=groups[k].filter(t=>t.type==="expense").reduce((a,t)=>a+t.amount,0);
    html+=`<div class="card">
      <div class="row between" style="margin-bottom:4px;flex-wrap:wrap">
        <b>${monthLabel(k)}</b>
        <span class="muted" style="font-size:12px"><span class="income">+${fmt2(inc)}</span> · <span class="expense">−${fmt2(exp)}</span> · solde <b class="${inc-exp>=0?'income':'expense'}">${fmt2(inc-exp)} ${cur()}</b></span>
      </div>
      ${groups[k].map(t=>`<div onclick="openTx('${t.id}')">${txRow(t)}</div>`).join('')}
    </div>`;
  }
  return html;
}
function renderTxList(){ const el=document.getElementById("txList"); if(el) el.innerHTML=txListHtml(); }

/* ----- MODAL AJOUT / MODIF TRANSACTION ----- */
function openTx(id){
  txEditId = (typeof id==="string") ? id : null;
  const t = txEditId ? DB.tx.find(x=>x.id===txEditId) : null;
  if(t){ txType=t.type; txCat=t.cat; } else { txType="expense"; txCat="alim"; }
  renderSheet(t);
  document.getElementById("modal").classList.add("show");
}
function closeSheet(){ document.getElementById("modal").classList.remove("show"); }
function setTxType(t){ txType=t; txCat = t==="income"?"salaire":"alim"; renderSheet(getDraft()); }
function setTxCat(id){ txCat=id; renderSheet(getDraft()); }
function getDraft(){
  const a=document.getElementById("txAmt"), l=document.getElementById("txLabel"), d=document.getElementById("txDate");
  return { amount: a&&a.value?parseFloat(a.value):"", label: l?l.value:"", date: d?d.value:"" };
}
function renderSheet(t){
  const cats = txType==="income"?INCOME_CATS:CATS;
  const chips=cats.map(c=>`<div class="catchip ${c.id===txCat?'on':''}" onclick="setTxCat('${c.id}')">${c.e} ${c.n}</div>`).join('');
  const today=new Date().toISOString().slice(0,10);
  document.getElementById("sheet").innerHTML=`
    <h3>${txEditId?'Modifier la transaction':'Nouvelle transaction'}</h3>
    <div class="seg">
      <button class="${txType==='expense'?'on':''}" onclick="setTxType('expense')" style="${txType==='expense'?'background:var(--expense)':''}">Dépense</button>
      <button class="${txType==='income'?'on':''}" onclick="setTxType('income')" style="${txType==='income'?'background:var(--income);color:#04210f':''}">Revenu</button>
    </div>
    <div class="field"><label>Montant (${cur()})</label>
      <input id="txAmt" type="number" inputmode="decimal" placeholder="0" value="${(t&&t.amount)||''}"></div>
    <div class="field"><label>Catégorie</label>
      <div class="catrow">${chips}</div></div>
    <div class="field"><label>Libellé (optionnel)</label>
      <input id="txLabel" type="text" placeholder="Ex : Courses Carrefour" value="${esc(t?t.label:'')}"></div>
    <div class="field"><label>Date</label>
      <input id="txDate" type="date" value="${(t&&t.date)||today}"></div>
    <button class="btn" onclick="addTx()">${txEditId?'Enregistrer':'Ajouter'}</button>
    ${txEditId?`<button class="btn ghost" style="margin-top:8px;color:var(--expense)" onclick="delTx()">Supprimer</button>`:''}
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Annuler</button>`;
  if(!txEditId) setTimeout(()=>{const a=document.getElementById("txAmt");if(a)a.focus();},100);
}
function addTx(){
  const amt=parseFloat(document.getElementById("txAmt").value);
  if(!amt||amt<=0){ toast("Entre un montant valide","err"); return; }
  const label=document.getElementById("txLabel").value.trim();
  const date=document.getElementById("txDate").value||new Date().toISOString().slice(0,10);
  if(txEditId){
    const t=DB.tx.find(x=>x.id===txEditId);
    if(t){ t.type=txType; t.cat=txCat; t.amount=amt; t.label=label; t.date=date; }
    save(); closeSheet(); toast("Transaction modifiée ✓"); render(); return;
  }
  DB.tx.push({ id:Date.now()+"_"+Math.random().toString(36).slice(2,7), type:txType, cat:txCat, amount:amt, label, date });
  save(); closeSheet();
  if(txType==="expense"){
    const b=DB.budgets[txCat];
    if(b){ const s=spentByCat(curMonth(),txCat);
      if(s>b) toast(`⛔ Budget ${catById(txCat).n} dépassé !`,"err");
      else if(s>=b*0.8) toast(`⚠️ Budget ${catById(txCat).n} bientôt atteint`,"warn");
      else toast("Transaction ajoutée ✓"); }
    else toast("Transaction ajoutée ✓");
  } else toast("Revenu ajouté ✓");
  render();
}
function delTx(){
  if(!txEditId) return;
  if(confirm("Supprimer cette transaction ?")){
    DB.tx=DB.tx.filter(t=>t.id!==txEditId); save(); closeSheet(); render(); toast("Transaction supprimée");
  }
}

/* ============ VUE BUDGETS ============ */
function viewBudget(){
  const m=viewMonth;
  let totalBudget=0,totalSpent=0;
  const rows=CATS.map(c=>{
    const b=DB.budgets[c.id]||0; const s=spentByCat(m,c.id);
    totalBudget+=b; totalSpent+=s;
    const r=b>0?s/b:0; const pct=Math.min(100,r*100);
    const color = r>=1?'var(--expense)': r>=0.8?'var(--amber)':'var(--income)';
    return `<div class="card" style="padding:13px">
      <div class="row between">
        <div class="row" style="gap:9px"><span style="font-size:18px">${c.e}</span><b>${c.n}</b></div>
        <button class="btn sm ghost" onclick="openBudgetSheet('${c.id}')">${b>0?'Modifier':'+ Définir'}</button>
      </div>
      ${b>0?`<div class="row between" style="margin-top:9px;font-size:13px">
        <span class="muted">${fmt(s)} dépensés</span><span style="color:${color};font-weight:700">${Math.round(r*100)}%</span></div>
      <div class="progwrap"><div class="progbar" style="width:${pct}%;background:${color}"></div></div>
      <div class="muted" style="font-size:11px;margin-top:5px">${b-s>=0?`Reste ${fmt(b-s)}`:`Dépassé de ${fmt(s-b)}`} · budget ${fmt(b)}</div>`
      :`<div class="muted" style="font-size:12px;margin-top:7px">Pas de budget défini · ${fmt(s)} dépensés sur ${monthLabel(m)}</div>`}
    </div>`;
  }).join('');
  const tr=totalBudget>0?totalSpent/totalBudget:0;
  return `<div class="wrap">
    <div class="card">
      <div class="muted">Budget total · ${monthLabel(m)}</div>
      <div class="big ${tr>=1?'expense':''}">${fmt(totalSpent)} <span style="font-size:16px;color:var(--muted)">/ ${fmt(totalBudget)}</span></div>
      <div class="progwrap"><div class="progbar" style="width:${Math.min(100,tr*100)}%;background:${tr>=1?'var(--expense)':tr>=0.8?'var(--amber)':'var(--income)'}"></div></div>
      <div class="muted" style="font-size:12px;margin-top:7px">Ton allocation est mémorisée : elle s'applique chaque mois jusqu'à modification (ici ou dans ⚙️ Paramètres). Alertes à 80% et 100%.</div>
    </div>
    ${rows}<div style="height:10px"></div></div>`;
}
function openBudgetSheet(catId){
  const c=catById(catId); const b=DB.budgets[catId]||"";
  document.getElementById("sheet").innerHTML=`
    <h3>${c.e} Budget mensuel — ${c.n}</h3>
    <div class="field"><label>Plafond mensuel (${cur()})</label>
      <input id="bVal" type="number" inputmode="decimal" placeholder="0" value="${b}"></div>
    <div class="muted" style="font-size:12px;margin-bottom:12px">Ce plafond restera mémorisé pour tous les mois suivants, jusqu'à ce que tu le changes.</div>
    <button class="btn" onclick="saveBudget('${catId}')">Enregistrer</button>
    ${b?`<button class="btn ghost" style="margin-top:8px;color:var(--expense)" onclick="removeBudget('${catId}')">Retirer ce budget</button>`:''}
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Annuler</button>`;
  document.getElementById("modal").classList.add("show");
  setTimeout(()=>{const a=document.getElementById("bVal");if(a)a.focus();},100);
}
function saveBudget(catId){
  const n=parseFloat(document.getElementById("bVal").value);
  if(!n||n<=0){ toast("Montant invalide","err"); return; }
  DB.budgets[catId]=n; save(); closeSheet(); render();
  toast(`Budget ${catById(catId).n} : ${fmt(n)} ✓`);
}
function removeBudget(catId){
  delete DB.budgets[catId]; save(); closeSheet(); render(); toast("Budget retiré");
}

/* ============ VUE ÉPARGNE / OBJECTIFS ============ */
function viewSave(){
  let goals=DB.goals.map((g,i)=>{
    const r=g.target>0?g.saved/g.target:0; const pct=Math.min(100,r*100);
    const done=g.saved>=g.target;
    return `<div class="card">
      <div class="row between">
        <div class="row" style="gap:9px"><span style="font-size:20px">${g.emoji||'🎯'}</span>
          <div><b>${esc(g.name)}</b><div class="muted" style="font-size:11px">Objectif ${fmt(g.target)}</div></div></div>
        <button class="del" onclick="delGoal(${i})">✕</button>
      </div>
      <div class="progwrap" style="height:10px"><div class="progbar" style="width:${pct}%;background:${done?'var(--income)':'var(--accent)'}"></div></div>
      <div class="row between" style="margin-top:7px">
        <b class="${done?'income':''}">${fmt(g.saved)}</b>
        <span class="muted">${done?'✓ Atteint !':`Reste ${fmt(g.target-g.saved)} · ${Math.round(r*100)}%`}</span>
      </div>
      <div class="row" style="gap:7px;margin-top:10px">
        <button class="btn sm ghost" style="flex:1" onclick="openGoalAmount(${i},1)">+ Ajouter</button>
        <button class="btn sm ghost" style="flex:1" onclick="openGoalAmount(${i},-1)">− Retirer</button>
      </div>
    </div>`;
  }).join('');
  if(DB.goals.length===0) goals='<div class="card"><div class="empty">Aucun objectif.<br>Crée ton premier objectif d\'épargne 🎯</div></div>';
  const totalSaved=DB.goals.reduce((a,g)=>a+g.saved,0);
  const totalTarget=DB.goals.reduce((a,g)=>a+g.target,0);
  return `<div class="wrap">
    <div class="card">
      <div class="muted">Épargne totale</div>
      <div class="big income">${fmt(totalSaved)}</div>
      ${totalTarget>0?`<div class="muted" style="font-size:12px">sur ${fmt(totalTarget)} d'objectifs (${Math.round(totalSaved/totalTarget*100)}%)</div>`:''}
    </div>
    <button class="btn" onclick="openGoalSheet()">+ Nouvel objectif</button>
    <div style="height:13px"></div>
    ${goals}
    <div class="card">
      <b>💡 Règle des 50/30/20</b>
      <div class="muted" style="line-height:1.6;margin-top:7px;font-size:12.5px">
      Une méthode simple pour répartir tes revenus :<br>
      • <b style="color:var(--blue)">50%</b> besoins (loyer, courses, factures)<br>
      • <b style="color:var(--pur)">30%</b> envies (loisirs, resto, shopping)<br>
      • <b style="color:var(--income)">20%</b> épargne & investissement
      </div>
    </div>
    <div style="height:10px"></div></div>`;
}
function openGoalSheet(){
  document.getElementById("sheet").innerHTML=`
    <h3>🎯 Nouvel objectif d'épargne</h3>
    <div class="field"><label>Nom</label><input id="gName" type="text" placeholder="Ex : Vacances, Fonds d'urgence"></div>
    <div class="field"><label>Montant à atteindre (${cur()})</label><input id="gTarget" type="number" inputmode="decimal" placeholder="0"></div>
    <button class="btn" onclick="createGoal()">Créer</button>
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Annuler</button>`;
  document.getElementById("modal").classList.add("show");
  setTimeout(()=>{const a=document.getElementById("gName");if(a)a.focus();},100);
}
function createGoal(){
  const name=document.getElementById("gName").value.trim();
  const target=parseFloat(document.getElementById("gTarget").value);
  if(!name){ toast("Donne un nom à l'objectif","err"); return; }
  if(!target||target<=0){ toast("Montant invalide","err"); return; }
  const emojis=['🎯','✈️','🏠','🚗','💻','🎓','💍','🛡️','🏖️'];
  DB.goals.push({name,target,saved:0,emoji:emojis[DB.goals.length%emojis.length]});
  save(); closeSheet(); render(); toast("Objectif créé 🎯");
}
function openGoalAmount(i,sign){
  const g=DB.goals[i];
  document.getElementById("sheet").innerHTML=`
    <h3>${g.emoji||'🎯'} ${sign>0?'Ajouter à':'Retirer de'} « ${esc(g.name)} »</h3>
    <div class="field"><label>Montant (${cur()})</label><input id="gAmt" type="number" inputmode="decimal" placeholder="0"></div>
    <button class="btn" onclick="applyGoalAmount(${i},${sign})">${sign>0?'Ajouter':'Retirer'}</button>
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Annuler</button>`;
  document.getElementById("modal").classList.add("show");
  setTimeout(()=>{const a=document.getElementById("gAmt");if(a)a.focus();},100);
}
function applyGoalAmount(i,sign){
  const g=DB.goals[i];
  const v=parseFloat(document.getElementById("gAmt").value);
  if(!v||v<=0){ toast("Montant invalide","err"); return; }
  g.saved=Math.max(0,g.saved+sign*v); save(); closeSheet(); render();
  if(g.saved>=g.target) toast("🎉 Objectif atteint !");
  else toast(sign>0?"Épargne ajoutée ✓":"Retiré");
}
function delGoal(i){ if(confirm("Supprimer cet objectif ?")){ DB.goals.splice(i,1); save(); render(); } }

/* ============ VUE PARAMÈTRES ============ */
function viewSettings(){
  const alloc=CATS.map(c=>`
    <div class="row between" style="padding:6px 0">
      <span style="flex:1">${c.e} ${c.n}</span>
      <input class="allocin" id="alloc_${c.id}" type="number" inputmode="decimal" placeholder="—"
        value="${DB.budgets[c.id]||''}" style="width:110px;text-align:right">
    </div>`).join('');
  const totalAlloc=CATS.reduce((a,c)=>a+(DB.budgets[c.id]||0),0);
  const CURRENCIES=["€","$","£","CHF","MAD","DA","TND","FCFA"];
  const curOpts=CURRENCIES.map(x=>`<option value="${x}" ${cur()===x?'selected':''}>${x}</option>`).join('');
  return `<div class="wrap">
    <div class="card">
      <b style="font-size:15px">💶 Allocation du budget mensuel</b>
      <div class="muted" style="font-size:12px;margin:6px 0 10px">Saisis tes plafonds une seule fois : ils sont mémorisés et s'appliquent tous les mois, jusqu'à modification ici.</div>
      ${alloc}
      <div class="row between" style="margin-top:8px;font-weight:800">
        <span>Total alloué</span><span>${fmt(totalAlloc)}</span>
      </div>
      <button class="btn" style="margin-top:12px" onclick="saveAlloc()">Enregistrer l'allocation</button>
    </div>

    <div class="card">
      <b style="font-size:15px">🎨 Apparence</b>
      <div class="field" style="margin-top:10px"><label>Thème</label>
        <div class="seg" style="margin:0">
          <button class="${DB.settings.theme!=='light'?'on':''}" onclick="setTheme('dark')">🌙 Sombre</button>
          <button class="${DB.settings.theme==='light'?'on':''}" onclick="setTheme('light')">☀️ Clair</button>
        </div></div>
      <div class="field"><label>Devise</label>
        <select onchange="setCurrency(this.value)">${curOpts}</select></div>
    </div>

    <div class="card">
      <b style="font-size:15px">💾 Sauvegarde des données</b>
      <div class="muted" style="font-size:12px;margin:6px 0 10px">Tes données sont stockées sur ton appareil. Fais une sauvegarde régulière pour ne rien perdre (changement de téléphone, réinstallation…).</div>
      <button class="btn ghost" onclick="exportJSON()">⬇️ Exporter la sauvegarde (.json)</button>
      <button class="btn ghost" style="margin-top:8px" onclick="document.getElementById('importFile').click()">⬆️ Importer une sauvegarde</button>
      <input type="file" id="importFile" accept=".json,application/json" style="display:none" onchange="importJSON(this)">
      <button class="btn ghost" style="margin-top:8px" onclick="exportCSV()">📊 Exporter les transactions (.csv)</button>
      <hr class="sep">
      <button class="btn ghost" style="color:var(--expense)" onclick="resetAll()">🗑️ Tout effacer</button>
    </div>

    <div class="card">
      <div class="muted" style="font-size:11.5px;line-height:1.6">
        Mes Finances v2 · ${DB.tx.length} transaction(s) enregistrée(s)<br>
        <span id="persistInfo">${persistMsg}</span>
      </div>
    </div>
    <div style="height:10px"></div></div>`;
}
let persistMsg = "Stockage : vérification…";
function saveAlloc(){
  CATS.forEach(c=>{
    const el=document.getElementById("alloc_"+c.id); if(!el) return;
    const n=parseFloat(el.value);
    if(n>0) DB.budgets[c.id]=n; else delete DB.budgets[c.id];
  });
  save(); render(); toast("Allocation enregistrée ✓");
}
function setTheme(t){
  DB.settings.theme=t; save(); applyTheme(); render();
}
function applyTheme(){
  document.documentElement.setAttribute("data-theme", DB.settings.theme==='light'?'light':'dark');
}
function setCurrency(c){ DB.settings.currency=c; save(); render(); toast("Devise : "+c); }

function download(name, content, type){
  const blob=new Blob([content],{type:type||"application/octet-stream"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},400);
}
function exportJSON(){
  download("mes-finances-sauvegarde-"+new Date().toISOString().slice(0,10)+".json",
    JSON.stringify(DB,null,2), "application/json");
  toast("Sauvegarde exportée ✓");
}
function importJSON(input){
  const f=input.files && input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=fix(JSON.parse(r.result));
      if(!confirm(`Importer ${d.tx.length} transaction(s) ? Les données actuelles seront remplacées.`)) return;
      DB=d; save(); applyTheme(); render(); toast("Sauvegarde importée ✓");
    }catch(e){ toast("Fichier invalide","err"); }
  };
  r.readAsText(f); input.value="";
}
function exportCSV(){
  const head="date;type;categorie;libelle;montant";
  const lines=DB.tx.map(t=>[t.date, t.type==="income"?"revenu":"depense", catById(t.cat).n,
    '"'+(t.label||"").replace(/"/g,'""')+'"', String(t.amount).replace('.',',')].join(';'));
  download("mes-finances-transactions.csv", "﻿"+[head].concat(lines).join("\n"), "text/csv;charset=utf-8");
  toast("CSV exporté ✓");
}
function resetAll(){
  if(!confirm("Tout effacer ? (transactions, budgets, objectifs)")) return;
  if(!confirm("Vraiment sûr ? Cette action est définitive. Pense à exporter une sauvegarde avant.")) return;
  DB=fix({}); save(); applyTheme(); render(); toast("Données effacées");
}

/* ============ VUE INVESTIR (ÉDUCATIF) ============ */
function viewInvest(){
  return `<div class="wrap">
    <div class="alert" style="background:rgba(77,158,246,.1);border-color:var(--blue);color:var(--blue)">
      ℹ️ Contenu éducatif uniquement — ceci n'est pas un conseil financier personnalisé. Renseigne-toi et/ou consulte un professionnel avant d'investir.
    </div>

    <div class="card">
      <b style="font-size:15px">Avant d'investir : les bases</b>
      <div class="adviceblk" style="margin-top:10px"><b>1. Fonds d'urgence d'abord.</b> Garde 3 à 6 mois de dépenses sur un livret sécurisé (ex : Livret A) avant tout investissement.</div>
      <div class="adviceblk"><b>2. Rembourse les dettes coûteuses.</b> Un crédit conso à 15% « rapporte » plus à rembourser qu'un placement moyen.</div>
      <div class="adviceblk"><b>3. Investis sur le long terme.</b> Plus l'horizon est long (5-10 ans+), plus le risque se lisse avec le temps.</div>
    </div>

    <div class="card">
      <b style="font-size:15px">Profils de risque</b>
      <div class="muted" style="font-size:12px;margin-bottom:6px">Répartition indicative selon ta tolérance</div>
      ${riskProfile("Prudent","Sécurité avant tout",[["Fonds €/Livrets",70,"var(--income)"],["Obligations",20,"var(--blue)"],["Actions",10,"var(--pur)"]])}
      ${riskProfile("Équilibré","Croissance modérée",[["Fonds €/Livrets",40,"var(--income)"],["Obligations",25,"var(--blue)"],["Actions",35,"var(--pur)"]])}
      ${riskProfile("Dynamique","Long terme, plus de risque",[["Fonds €/Livrets",15,"var(--income)"],["Obligations",20,"var(--blue)"],["Actions",65,"var(--pur)"]])}
    </div>

    <div class="card">
      <b style="font-size:15px">Enveloppes en France 🇫🇷</b>
      <div class="adviceblk" style="margin-top:10px"><b>Livret A / LDDS.</b> Sans risque, disponible, défiscalisé. Idéal pour le fonds d'urgence.</div>
      <div class="adviceblk"><b>Assurance-vie.</b> Souple, fiscalité avantageuse après 8 ans. Fonds euros (sécurisé) ou unités de compte (risqué).</div>
      <div class="adviceblk"><b>PEA.</b> Actions européennes, exonération d'impôt sur les gains après 5 ans (hors prélèvements sociaux).</div>
      <div class="adviceblk"><b>ETF / trackers.</b> Paniers d'actions diversifiés à frais réduits. Souvent logés dans un PEA ou une assurance-vie.</div>
    </div>

    <div class="card">
      <b style="font-size:15px">🧮 Simulateur intérêts composés</b>
      <div class="muted" style="font-size:12px;margin:5px 0 10px">Estime la croissance d'un placement régulier</div>
      <div class="field"><label>Versement mensuel (${cur()})</label><input id="ciMonthly" type="number" inputmode="decimal" value="100" oninput="calcCI()"></div>
      <div class="field"><label>Durée (années)</label><input id="ciYears" type="number" inputmode="numeric" value="10" oninput="calcCI()"></div>
      <div class="field"><label>Rendement annuel estimé (%)</label><input id="ciRate" type="number" inputmode="decimal" value="5" oninput="calcCI()"></div>
      <div id="ciResult"></div>
    </div>

    <div class="card">
      <b style="font-size:15px">⚠️ Pièges à éviter</b>
      <div class="muted" style="line-height:1.7;margin-top:8px;font-size:12.5px">
      • Promesses de gains rapides/garantis élevés = arnaque<br>
      • N'investis jamais ce que tu ne peux pas perdre<br>
      • Diversifie — ne mets pas tout au même endroit<br>
      • Méfie-toi des frais élevés qui grignotent les gains<br>
      • Évite les décisions sous le coup de l'émotion (FOMO, panique)
      </div>
    </div>
    <div style="height:10px"></div></div>`;
}
function riskProfile(name,desc,parts){
  const bar=parts.map(p=>`<div style="width:${p[1]}%;background:${p[2]}"></div>`).join('');
  const leg=parts.map(p=>`<span style="font-size:11px;color:var(--muted)"><span class="dot" style="background:${p[2]};display:inline-block;vertical-align:middle"></span> ${p[0]} ${p[1]}%</span>`).join(' &nbsp; ');
  return `<div style="margin:13px 0 4px"><div class="row between"><b style="font-size:13px">${name}</b><span class="muted" style="font-size:11px">${desc}</span></div>
    <div class="riskbar">${bar}</div><div style="line-height:1.8">${leg}</div></div>`;
}
function calcCI(){
  const m=parseFloat(document.getElementById("ciMonthly").value)||0;
  const y=parseFloat(document.getElementById("ciYears").value)||0;
  const r=(parseFloat(document.getElementById("ciRate").value)||0)/100;
  const n=y*12; const mr=r/12;
  let fv = mr>0 ? m*((Math.pow(1+mr,n)-1)/mr) : m*n;
  const invested=m*n; const gain=fv-invested;
  document.getElementById("ciResult").innerHTML=`
    <div class="grid2" style="margin-top:4px">
      <div class="stat"><div class="v">${fmt(invested)}</div><div class="l">Total versé</div></div>
      <div class="stat"><div class="v income">+${fmt(gain)}</div><div class="l">Gains estimés</div></div>
    </div>
    <div class="stat" style="margin-top:11px;text-align:center"><div class="v income" style="font-size:26px">${fmt(fv)}</div><div class="l">Capital final estimé après ${y} ans</div></div>`;
}

/* ============ INIT ============ */
function boot(){
  viewMonth = curMonth();
  applyTheme();
  go('dash');
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  /* Stockage persistant : empêche le système d'effacer les données (budgets, historique) */
  if(navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(ok=>{
      persistMsg = ok ? "Stockage : persistant ✓ (protégé contre l'effacement automatique)"
                      : "Stockage : standard (pense à exporter des sauvegardes)";
      const el=document.getElementById("persistInfo");
      if(el) el.textContent = persistMsg;
    }).catch(()=>{});
  }
}
boot();
