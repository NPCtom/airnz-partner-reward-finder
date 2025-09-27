(() => {
  if (window.__airnzFinderBooted) return; window.__airnzFinderBooted = true;

  const ON_ROUTE = () => location.pathname.includes("/partner-reward-flights/select-flight");
  const OFFERS_RX = /\/partner-reward-flights\/api\/flight-reward-offers\b/;
  const AVAIL_RX  = /\/partner-reward-flights\/api\/flight-reward-availabilities\b/;

  // ---------- UI ----------
  function pretty(iso){ return new Date((iso||"")+"T12:00:00").toLocaleDateString(undefined,{day:"2-digit",month:"long",year:"numeric"}); }
  let results = [];
  function render(){ const ul=document.getElementById("airnz-finder-list"); if(!ul) return; ul.innerHTML=results.map(r=>`<li>${r.text}</li>`).join(""); }
  function pushResult(from,to,cabin,date){ const text=`${from} - ${to} ${cabin} found on ${pretty(date)}`; results.push({from,to,cabin,date:pretty(date),text}); console.log(text); render(); }
  function setStatus(msg){ const el=document.getElementById("airnz-finder-status"); if(el) el.textContent=msg; console.log("[AirNZ Finder]", msg); }

  function ensurePanel(){
    if(!ON_ROUTE()) return;
    if(document.getElementById("airnz-finder-panel")) return;
    const wrap=document.createElement("div");
    wrap.id="airnz-finder-panel";
    wrap.innerHTML=`
      <style>
        #airnz-finder-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;background:#0b2d52;color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:13px/1.45 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
        #airnz-finder-panel header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.15)}
        #airnz-finder-title{font-weight:600}
        #airnz-finder-status{padding:6px 12px;background:#082c50;border-bottom:1px solid rgba(255,255,255,.15);font-size:12px;opacity:.95}
        #airnz-finder-body{max-height:260px;overflow:auto;background:#093055}
        #airnz-finder-body ul{list-style:none;margin:0;padding:0}
        #airnz-finder-body li{padding:8px 12px;border-bottom:1px dashed rgba(255,255,255,.15)}
        #airnz-finder-controls{display:flex;gap:8px;padding:10px 12px;background:#072746;border-top:1px solid rgba(255,255,255,.15)}
        #airnz-finder-controls button{flex:1;padding:8px 10px;border:0;border-radius:8px;cursor:pointer;color:#0b2d52;background:#fff}
        #airnz-finder-scan{background:#00b2ff;color:#002a4e}
        #airnz-finder-small{font-size:11px;opacity:.8;padding:0 12px 10px}
        #airnz-finder-toggle{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#082c50}
        #airnz-finder-toggle input{accent-color:#00b2ff}
        #airnz-scan-btn{position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:10px;border:0;background:#0052a3;color:#fff;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.2)}
      </style>
      <header>
        <div id="airnz-finder-title">Air NZ Partner Reward Finder</div>
        <button id="airnz-finder-close" title="Close" style="background:transparent;border:0;color:#fff;font-size:16px;cursor:pointer">×</button>
      </header>
      <div id="airnz-finder-status">Ready</div>
      <div id="airnz-finder-toggle">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="airnz-econ" />
          <span>Include Economy</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto">
          <input type="checkbox" id="airnz-biz" checked />
          <span>Include Business</span>
        </label>
      </div>
      <div id="airnz-finder-body"><ul id="airnz-finder-list"></ul></div>
      <div id="airnz-finder-controls">
        <button id="airnz-finder-scan">Scan</button>
        <button id="airnz-finder-copy">Copy</button>
        <button id="airnz-finder-csv">CSV</button>
        <button id="airnz-finder-clear">Clear</button>
      </div>
      <div id="airnz-finder-small">Uses your current search & login • Console also logs results</div>
    `;
    document.documentElement.appendChild(wrap);

    const addFloat=()=>{ if(document.getElementById("airnz-scan-btn")) return;
      const b=document.createElement("button"); b.id="airnz-scan-btn"; b.textContent="Scan reward dates";
      b.onclick=()=>window.dispatchEvent(new CustomEvent("airnz-start-scan"));
      document.body.appendChild(b);
    };
    addFloat();

    document.getElementById("airnz-finder-close").onclick=()=>wrap.remove();
    document.getElementById("airnz-finder-clear").onclick=()=>{results=[];render();setStatus("Cleared");};
    document.getElementById("airnz-finder-copy").onclick=()=>navigator.clipboard.writeText(results.map(r=>r.text).join("\n"));
    document.getElementById("airnz-finder-csv").onclick=()=>{
      const csv="From,To,Class,Date\n"+results.map(r=>`${r.from},${r.to},${r.cabin},${r.date}`).join("\n");
      const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a");
      a.href=URL.createObjectURL(blob); a.download="airnz-partner-reward-finder.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3e3);
    };
    document.getElementById("airnz-finder-scan").onclick=()=>window.dispatchEvent(new CustomEvent("airnz-start-scan"));

    const mo=new MutationObserver(()=>{ if(ON_ROUTE()&&!document.getElementById("airnz-finder-panel")) ensurePanel();
      if(ON_ROUTE()&&!document.getElementById("airnz-scan-btn")) addFloat(); });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  // ---------- capture ----------
  window.__airnz = {
    bearer: null,
    lastCalendarJson: null,
    templates: { availabilitiesBody: null, offersBody: null },
    headers:   { offers: null, avail: null } // full header maps captured from last legit calls
  };

  function headersToMap(h) {
    const out = {};
    if (!h) return out;
    if (h instanceof Headers) { for (const [k,v] of h.entries()) out[k] = v; return out; }
    if (typeof h === "object") { for (const k of Object.keys(h)) out[k] = h[k]; return out; }
    return out;
  }
  function capBearerFromHeaders(h) {
    try {
      if (!h) return;
      if (h instanceof Headers) {
        const v=h.get("Authorization")||h.get("authorization"); if(!window.__airnz.bearer && v && /^Bearer\s+/.test(v)) window.__airnz.bearer=v;
      } else if (typeof h==="object") {
        const v=h.Authorization||h.authorization; if(!window.__airnz.bearer && v && /^Bearer\s+/.test(v)) window.__airnz.bearer=v;
      }
    } catch(_) {}
  }

  const origFetch = window.fetch;
  const origOpen  = XMLHttpRequest.prototype.open;
  const origSend  = XMLHttpRequest.prototype.send;
  const origSetRH = XMLHttpRequest.prototype.setRequestHeader;

  // XHR header capture
  XMLHttpRequest.prototype.open = function(method, url){
    this.__airnzUrl = url;
    this.__airnzHdr = {};
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(k,v){
    try {
      this.__airnzHdr[k] = v;
      if ((k.toLowerCase()==="authorization") && !window.__airnz.bearer && /^Bearer\s+/.test(v)) window.__airnz.bearer = v;
    } catch(_) {}
    return origSetRH.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body){
    try {
      const url = this.__airnzUrl || "";
      if (typeof body === "string") {
        if (AVAIL_RX.test(url)) window.__airnz.templates.availabilitiesBody = JSON.parse(body);
        if (OFFERS_RX.test(url)) window.__airnz.templates.offersBody         = JSON.parse(body);
      }
      if (OFFERS_RX.test(url)) window.__airnz.headers.offers = Object.assign({}, this.__airnzHdr);
      if (AVAIL_RX.test(url))  window.__airnz.headers.avail  = Object.assign({}, this.__airnzHdr);
    } catch(_) {}
    return origSend.apply(this, arguments);
  };

  // fetch capture (covers Request object + init.headers)
  async function cloneJson(res){ try{ const ct=res.headers.get("content-type")||""; if(!ct.includes("application/json")) return null; return await res.clone().json(); }catch(_){ return null; } }
  window.fetch = async function(i, init){
    const url = typeof i==="string" ? i : (i && i.url) || "";
    if (init && init.headers) capBearerFromHeaders(init.headers);
    try { if (i && i.headers) capBearerFromHeaders(i.headers); } catch(_){}
    if (init && typeof init.body === "string") {
      try {
        if (AVAIL_RX.test(url)) window.__airnz.templates.availabilitiesBody = JSON.parse(init.body);
        if (OFFERS_RX.test(url)) window.__airnz.templates.offersBody         = JSON.parse(init.body);
      } catch(_) {}
    }
    if (OFFERS_RX.test(url)) window.__airnz.headers.offers = headersToMap((init && init.headers) || (i && i.headers));
    if (AVAIL_RX .test(url)) window.__airnz.headers.avail  = headersToMap((init && init.headers) || (i && i.headers));

    const res = await origFetch.apply(this, arguments);
    try {
      const j = await cloneJson(res);
      if (j && Array.isArray(j.outbounds) && j.outbounds.every(o=>o && o.dateLocal)) window.__airnz.lastCalendarJson = j;
    } catch(_){}
    return res;
  };

  // ---------- cabin logic ----------
  function isBusinessOffer(offer){
    const svc=(offer.serviceClass||offer.cabinClass||"").toLowerCase();
    if (svc==="business") return true;
    const seg=(offer.flightSegments||[]).map(s=>(s.cabinClass||"").toLowerCase()).filter(Boolean);
    if (seg.length && seg.every(c=>c==="business")) return true;
    return (offer.flightSegments||[]).some(s => String(s.bookingClass||"").toUpperCase()==="I");
  }
  function isEconomyOffer(offer){
    const svc=(offer.serviceClass||offer.cabinClass||"").toLowerCase();
    if (svc==="economy") return true;
    const seg=(offer.flightSegments||[]).map(s=>(s.cabinClass||"").toLowerCase()).filter(Boolean);
    return (seg.length && seg.every(c=>c==="economy"));
  }
  function passesAvailability(_offer){ return true; }

  // ---------- deep date swap ----------
  function cloneAndSwapDateEverywhere(tmpl, newDate){
    const origDate = tmpl?.outbounds?.[0]?.dateLocal;
    const esc=s=>s.replace(/[-/\\^$*+?.()|[\]{}]/g,"\\$&");
    const reExact = origDate ? new RegExp("^"+esc(origDate)+"$") : null;
    const reEmbed = origDate ? new RegExp(esc(origDate),"g") : null;
    const reIso   = /^\d{4}-\d{2}-\d{2}T/;
    const clone = JSON.parse(JSON.stringify(tmpl));
    const walk=(o)=>{
      if(Array.isArray(o)){ o.forEach(walk); return; }
      if(!o || typeof o!=="object") return;
      for(const k of Object.keys(o)){
        const v=o[k], kl=k.toLowerCase();
        if (typeof v==="string"){
          if (reExact && reExact.test(v)) { o[k]=newDate; continue; }
          if (reIso.test(v) && (kl.includes("date")||kl.includes("day"))) { o[k]=newDate+v.slice(10); continue; }
          if (reEmbed && v.includes(origDate)) { o[k]=v.replace(reEmbed,newDate); continue; }
          if ((kl.includes("date")||kl.includes("day")) && /^\d{4}-\d{2}-\d{2}$/.test(v)) { o[k]=newDate; continue; }
        } else if (v && typeof v==="object"){ walk(v); }
      }
    };
    walk(clone);
    if (clone?.outbounds?.[0]) clone.outbounds[0].dateLocal=newDate;
    return clone;
  }

  function pLimit(n){ let a=0,q=[]; const next=()=>{ if(a>=n||!q.length) return; a++; const {fn,ok,err}=q.shift(); fn().then(ok,err).finally(()=>{a--;next();}); }; return fn=>new Promise((ok,err)=>{ q.push({fn,ok,err}); next(); }); }

  // ---------- scanner ----------
  async function startScan(){
    if (!ON_ROUTE()) { console.warn("[AirNZ Finder] Not on select-flight route."); return; }
    ensurePanel();
    document.getElementById("airnz-finder-scan")?.setAttribute("disabled","");
    document.getElementById("airnz-scan-btn")?.setAttribute("disabled","");
    setStatus("Preparing scan…");

    // Build headers to replay: use last offers headers (includes Authorization, Accept-Language, etc.)
    const baseHdrs = Object.assign({}, window.__airnz.headers?.offers || {});
    baseHdrs["Content-Type"] = "application/json";
    const bearer = window.__airnz.bearer || baseHdrs.Authorization || baseHdrs.authorization;
    if (!bearer) { setStatus("No session yet — click the calendar and any date, then Scan."); enableBtns(); return; }

    const OFF = "https://www.airnewzealand.co.nz/partner-reward-flights/api/flight-reward-offers";
    const AV  = "https://www.airnewzealand.co.nz/partner-reward-flights/api/flight-reward-availabilities";

    // dates
    let dates = window.__airnz.lastCalendarJson?.outbounds?.map(o=>o.dateLocal) || [];
    const tmpl = window.__airnz.templates.offersBody;
    if (!tmpl) { setStatus("Click any date once, then Scan."); enableBtns(); return; }
    const selectedDate = tmpl?.outbounds?.[0]?.dateLocal;
    if (selectedDate && !dates.includes(selectedDate)) dates.unshift(selectedDate);
    if (!dates.length) {
      const ab = window.__airnz.templates.availabilitiesBody;
      const abHdrs = Object.assign({}, window.__airnz.headers?.avail || {}, {"Content-Type":"application/json"});
      if (!ab) { setStatus("Click the calendar to load dates, then Scan."); enableBtns(); return; }
      const r = await fetch(AV, { method:"POST", credentials:"include", headers:abHdrs, body:JSON.stringify(ab) });
      if (r.ok) { const j = await r.json(); dates = (j.outbounds||[]).map(o=>o.dateLocal); }
    }
    if (!dates.length) { setStatus("No candidate dates."); enableBtns(); return; }

    const incEconomy = document.getElementById("airnz-econ")?.checked;
    const incBusiness = document.getElementById("airnz-biz")?.checked;
    const wantCabins = (offer)=> (incBusiness && isBusinessOffer(offer)) || (incEconomy && isEconomyOffer(offer));

    setStatus(`Scanning ${dates.length} dates… 0/${dates.length}`);
    console.log(`[AirNZ Finder] Probing ${dates.length} dates…`);
    const seen = new Set();
    const limit = pLimit(3);
    let done = 0;
    const startFound = results.length;

    await Promise.all(dates.map(d => limit(async () => {
      await new Promise(r=>setTimeout(r, 120 + Math.random()*180));
      const body = cloneAndSwapDateEverywhere(tmpl, d);

      const res = await fetch(OFF, {
        method:"POST",
        credentials:"include",
        headers: baseHdrs,
        body: JSON.stringify(body)
      });

      if (res.status === 404) {
        try { const j = await res.json(); console.info(`[AirNZ Finder] ${d}: 404 ${j?.detail||"Not Found"}`); } catch(_) {}
      } else if (res.ok || res.status === 201) {
        const data = await res.json(); if (data?.type === "REWARD_FLIGHT") {
          for (const leg of (data.resultSearchLegs||[])) {
            const from = leg.departureCityCode, to = leg.arrivalCityCode;
            const dateLocal = leg.departureDateLocal || d;
            for (const offer of (leg.offers||[])) {
              if (!wantCabins(offer)) continue;
              if (!passesAvailability(offer)) continue;
              const cabin = isBusinessOffer(offer) ? "Business" : "Economy";
              const key = `${from}|${to}|${dateLocal}|${cabin}`;
              if (seen.has(key)) continue; seen.add(key);
              pushResult(from, to, cabin, dateLocal);
            }
          }
        }
      } else {
        console.info(`[AirNZ Finder] ${d}: HTTP ${res.status}`);
      }

      done++;
      if (done === dates.length || done % 3 === 0) {
        setStatus(`Scanning ${dates.length} dates… ${done}/${dates.length}`);
      }
    })));

    const foundNow = results.length - startFound;
    if (foundNow > 0) {
      const incEco = document.getElementById("airnz-econ")?.checked;
      const incBiz = document.getElementById("airnz-biz")?.checked;
      let cabinText = "seats";
      if (incBiz && !incEco) cabinText = "Business seats";
      else if (!incBiz && incEco) cabinText = "Economy seats";
      setStatus(`Scan complete — ${foundNow} ${cabinText} found.`);
    } else {
      const onlyBiz = document.getElementById("airnz-biz")?.checked && !document.getElementById("airnz-econ")?.checked;
      setStatus(onlyBiz ? "No Business seats found." : "No seats found for selected cabins.");
    }

    enableBtns();
  }

  function enableBtns(){
    document.getElementById("airnz-finder-scan")?.removeAttribute("disabled");
    document.getElementById("airnz-scan-btn")?.removeAttribute("disabled");
  }

  // ---------- boot ----------
  function boot(){ if (!ON_ROUTE()) return; ensurePanel(); setStatus("Ready"); }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.addEventListener("airnz-start-scan", startScan);
  window.airnzScan = startScan;
})();
