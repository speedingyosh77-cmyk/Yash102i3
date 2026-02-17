import { useState, useRef, useEffect } from "react";

const SYSTEM = `Anda adalah Yashmiq ChatBot AI — pembantu pintar berbahasa Melayu yang mesra dan sentiasa memberikan maklumat tepat.

PERATURAN WAJIB:
1. SENTIASA gunakan web_search untuk soalan yang melibatkan fakta, berita terkini, sukan, harga, cuaca, nama individu, tarikh peristiwa, atau apa-apa maklumat dunia nyata.
2. JANGAN jawab soalan fakta dari ingatan semata-mata — MESTI cari di web dahulu untuk maklumat yang tepat dan terkini.
3. Pilih sumber yang paling dipercayai: media rasmi, laman berita utama, laman kerajaan.
4. Nyatakan sumber maklumat dalam jawapan apabila berkaitan.
5. Jawab dalam Bahasa Melayu yang ringkas, padat, dan mudah difahami.
6. Untuk soalan kreativiti (pantun, sajak, cerita) atau perbualan biasa — boleh jawab terus tanpa carian web.`;

const CHIPS = [
  { icon:"⚽", label:"Son Heung-min terkini", q:"Son Heung-min sekarang main di kelab mana? Berikan maklumat terkini." },
  { icon:"🏛️", label:"PM Malaysia", q:"Siapa Perdana Menteri Malaysia sekarang?" },
  { icon:"⛽", label:"Harga petrol", q:"Harga minyak petrol RON95 dan RON97 terkini di Malaysia?" },
  { icon:"🌙", label:"Puasa Ramadan 2026", q:"Tarikh puasa Ramadan 2026 di Malaysia bila?" },
  { icon:"📰", label:"Berita terkini", q:"Apa berita terkini Malaysia hari ini?" },
  { icon:"✍️", label:"Tulis pantun", q:"Tulis pantun 4 kerat yang indah tentang Malaysia" },
  { icon:"📚", label:"Tips belajar", q:"Tips belajar yang berkesan untuk pelajar Malaysia" },
  { icon:"🍗", label:"Rendang ayam", q:"Resepi rendang ayam yang sedap dan mudah" },
];

function Dots() {
  return (
    <div style={{display:"flex",gap:5,alignItems:"center",padding:"4px 0"}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{
          width:6,height:6,borderRadius:"50%",
          background:["#3b82f6","#06b6d4","#8b5cf6"][i],
          animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`
        }}/>
      ))}
    </div>
  );
}

function renderText(text) {
  return text.split("\n").map((line,i,arr)=>{
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p,j)=>{
      if(p.startsWith("**")&&p.endsWith("**")) return <strong key={j} style={{color:"#93c5fd"}}>{p.slice(2,-2)}</strong>;
      if(p.startsWith("*")&&p.endsWith("*")) return <em key={j} style={{color:"#67e8f9"}}>{p.slice(1,-1)}</em>;
      if(p.startsWith("`")&&p.endsWith("`")) return <code key={j} style={{background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.15)",padding:"1px 5px",borderRadius:4,fontSize:12,fontFamily:"monospace",color:"#93c5fd"}}>{p.slice(1,-1)}</code>;
      return p;
    });
    return <span key={i}>{parts}{i<arr.length-1&&<br/>}</span>;
  });
}

export default function YashmiqChatBot() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const chatRef = useRef(null);
  const taRef = useRef(null);
  const histRef = useRef([]);

  useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  },[msgs,busy]);

  const time = ()=>new Date().toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit"});

  async function send(text) {
    const q = text||input.trim();
    if(!q||busy) return;
    setInput("");
    if(taRef.current) taRef.current.style.height="auto";

    setMsgs(p=>[...p,{role:"user",text:q,time:time()}]);
    histRef.current = [...histRef.current,{role:"user",content:q}];
    setBusy(true); setSearching(true);

    try {
      // Call 1 — with web search
      const r1 = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1024,
          system:SYSTEM,
          messages:histRef.current,
          tools:[{type:"web_search_20250305",name:"web_search"}]
        })
      });

      if(!r1.ok){const e=await r1.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r1.status}`);}
      const d1 = await r1.json();

      let finalText="", usedWeb=false;
      if(d1.content) for(const b of d1.content) if(b.type==="text") finalText+=b.text;

      if(d1.stop_reason==="tool_use"){
        usedWeb=true;
        histRef.current=[...histRef.current,{role:"assistant",content:d1.content}];

        const results = d1.content.filter(b=>b.type==="tool_use").map(b=>({
          type:"tool_result",tool_use_id:b.id,
          content:"Carian web selesai. Berikan jawapan lengkap dan tepat berdasarkan maklumat terkini."
        }));
        histRef.current=[...histRef.current,{role:"user",content:results}];

        setSearching(false);

        // Call 2 — final answer
        const r2 = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:1024,
            system:SYSTEM,
            messages:histRef.current
          })
        });
        const d2 = await r2.json();
        finalText="";
        if(d2.content){
          for(const b of d2.content) if(b.type==="text") finalText+=b.text;
          histRef.current=[...histRef.current,{role:"assistant",content:d2.content}];
        }
      } else {
        setSearching(false);
        if(d1.content) histRef.current=[...histRef.current,{role:"assistant",content:d1.content}];
      }

      if(!finalText) finalText="Maaf, saya tidak dapat memproses jawapan. Sila cuba lagi.";
      setMsgs(p=>[...p,{role:"bot",text:finalText,time:time(),web:usedWeb}]);

    } catch(err){
      setSearching(false);
      histRef.current=histRef.current.slice(0,-1);
      setMsgs(p=>[...p,{role:"bot",text:"⚠️ Maaf, berlaku masalah. Sila cuba lagi.",time:time(),err:true}]);
    } finally {
      setBusy(false);
    }
  }

  function clear(){setMsgs([]);histRef.current=[];}
  const showWelcome = msgs.length===0;

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#04060d",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",overflow:"hidden",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-6px);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}50%{box-shadow:0 0 16px rgba(99,102,241,.25)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2540;border-radius:2px}
        .chip:hover{background:rgba(59,130,246,.1)!important;border-color:rgba(59,130,246,.25)!important;color:#bfdbfe!important;transform:translateY(-1px)}
        .sbtn:hover:not(:disabled){transform:scale(1.06);box-shadow:0 4px 16px rgba(59,130,246,.35)!important}
        .sbtn:active:not(:disabled){transform:scale(.95)}
        .cbtn:hover{border-color:rgba(239,68,68,.25)!important;color:#fca5a5!important}
      `}</style>

      {/* BG */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 60% 40% at 50% 30%,rgba(59,130,246,.05) 0%,transparent 70%)"}}/>

      {/* HEADER */}
      <div style={{position:"relative",zIndex:10,padding:"12px 16px",background:"rgba(4,6,13,.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid #1a2540",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#1d3a6e,#3b1d8a)",border:"1px solid rgba(99,102,241,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,animation:"pulse 4s ease-in-out infinite"}}>✦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"#e2e8f0",letterSpacing:-.3}}>Yashmiq ChatBot AI</div>
            <div style={{fontSize:9,color:"#4a5568",letterSpacing:"1.5px",textTransform:"uppercase"}}>Pembantu Pintar Bahasa Melayu</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {[{s:"rgba(6,182,212,.08)",b:"rgba(6,182,212,.2)",c:"#22d3ee",t:"🌐 Carian Web"},
            {s:"rgba(16,185,129,.08)",b:"rgba(16,185,129,.2)",c:"#34d399",dot:true,t:"Aktif"}
          ].map((x,i)=>(
            <div key={i} style={{padding:"4px 9px",borderRadius:20,fontSize:10,fontWeight:500,display:"flex",alignItems:"center",gap:4,background:x.s,border:`1px solid ${x.b}`,color:x.c}}>
              {x.dot&&<div style={{width:5,height:5,borderRadius:"50%",background:"#34d399",animation:"blink 2s ease-in-out infinite"}}/>}{x.t}
            </div>
          ))}
          <button className="cbtn" onClick={clear} style={{background:"none",border:"1px solid #1a2540",color:"#4a5568",padding:"4px 8px",borderRadius:7,fontSize:10,cursor:"pointer",transition:"all .2s",fontFamily:"inherit"}}>Bersih</button>
        </div>
      </div>

      {/* CHAT */}
      <div ref={chatRef} style={{flex:1,overflowY:"auto",position:"relative",zIndex:1,display:"flex",flexDirection:"column"}}>

        {/* WELCOME */}
        {showWelcome&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 24px 30px",animation:"fadeUp .6s ease",minHeight:"100%"}}>
            <div style={{width:72,height:72,background:"linear-gradient(145deg,#0f1e3d,#1a1040)",border:"1px solid rgba(99,102,241,.25)",borderRadius:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,marginBottom:20,boxShadow:"0 0 40px rgba(99,102,241,.12)",animation:"float 5s ease-in-out infinite"}}>✦</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#e2e8f0",marginBottom:6,textAlign:"center"}}>Assalamualaikum!</h2>
            <p style={{fontSize:13,color:"#718096",textAlign:"center",marginBottom:18,lineHeight:1.5,maxWidth:260}}>
              Saya <span style={{color:"#60a5fa",fontWeight:500}}>Yashmiq ChatBot AI</span> — pembantu pintar dengan carian web terkini!
            </p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:22}}>
              {[["rgba(59,130,246,.08)","rgba(59,130,246,.2)","#93c5fd","🌐 Carian web masa nyata"],
                ["rgba(16,185,129,.08)","rgba(16,185,129,.2)","#6ee7b7","✅ Jawapan tepat & terkini"],
                ["rgba(139,92,246,.08)","rgba(139,92,246,.2)","#c4b5fd","💬 Bahasa Melayu"]
              ].map(([bg,bd,c,t])=>(
                <span key={t} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:500,display:"flex",alignItems:"center",gap:5,background:bg,border:`1px solid ${bd}`,color:c}}>{t}</span>
              ))}
            </div>
            <div style={{fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"#4a5568",marginBottom:10,fontWeight:600}}>Cuba tanya saya</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",maxWidth:340}}>
              {CHIPS.map(c=>(
                <div key={c.label} className="chip" onClick={()=>send(c.q)} style={{padding:"7px 13px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:20,fontSize:12,color:"#718096",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all .2s",whiteSpace:"nowrap"}}>
                  <span style={{fontSize:13}}>{c.icon}</span>{c.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {msgs.length>0&&(
          <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:14}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:9,flexDirection:m.role==="user"?"row-reverse":"row",animation:"msgIn .25s ease"}}>
                <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,alignSelf:"flex-end",background:m.role==="bot"?"linear-gradient(135deg,#1d3a6e,#3b1d8a)":"linear-gradient(135deg,#1d4ed8,#5b21b6)",border:m.role==="bot"?"1px solid rgba(99,102,241,.2)":"none"}}>
                  {m.role==="bot"?"✦":"👤"}
                </div>
                <div style={{maxWidth:"calc(100% - 75px)"}}>
                  {m.role==="bot"&&m.web&&(
                    <div style={{fontSize:10,color:"#22d3ee",display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                      🌐 <span>Maklumat dari carian web</span>
                    </div>
                  )}
                  <div style={{padding:"11px 14px",borderRadius:14,fontSize:14,lineHeight:1.65,background:m.err?"rgba(239,68,68,.06)":m.role==="bot"?"#0d1220":"#152a52",border:m.err?"1px solid rgba(239,68,68,.2)":m.role==="bot"?"1px solid #1a2540":"1px solid rgba(59,130,246,.15)",borderBottomLeftRadius:m.role==="bot"?4:14,borderBottomRightRadius:m.role==="user"?4:14,color:m.err?"#fca5a5":m.role==="user"?"#bfdbfe":"#e2e8f0"}}>
                    {m.role==="bot"&&!m.err?renderText(m.text):m.text}
                  </div>
                  <div style={{fontSize:9,color:"#4a5568",marginTop:3,textAlign:m.role==="user"?"right":"left"}}>{m.time}</div>
                </div>
              </div>
            ))}

            {/* Typing */}
            {busy&&(
              <div style={{display:"flex",gap:9}}>
                <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,alignSelf:"flex-end",background:"linear-gradient(135deg,#1d3a6e,#3b1d8a)",border:"1px solid rgba(99,102,241,.2)"}}>✦</div>
                <div>
                  {searching&&(
                    <div style={{fontSize:10,color:"#22d3ee",display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                      <div style={{width:9,height:9,border:"1.5px solid rgba(6,182,212,.3)",borderTopColor:"#06b6d4",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
                      Mencari maklumat terkini dari web...
                    </div>
                  )}
                  <div style={{padding:"11px 14px",borderRadius:14,background:"#0d1220",border:"1px solid #1a2540",borderBottomLeftRadius:4}}>
                    <Dots/>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* INPUT */}
      <div style={{position:"relative",zIndex:10,padding:"10px 14px 14px",background:"rgba(4,6,13,.95)",backdropFilter:"blur(20px)",borderTop:"1px solid #1a2540",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,background:"#0f1420",border:"1px solid #1a2540",borderRadius:14,padding:"9px 10px"}}>
          <textarea
            ref={taRef}
            value={input}
            disabled={busy}
            onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Tanya apa sahaja — saya akan cari maklumat terkini!"
            rows={1}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",fontSize:14,lineHeight:1.5,resize:"none",minHeight:22,maxHeight:100,overflowY:"auto"}}
          />
          <button className="sbtn" onClick={()=>send()} disabled={busy||!input.trim()} style={{width:32,height:32,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",border:"none",borderRadius:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0,boxShadow:"0 2px 10px rgba(59,130,246,.25)",opacity:busy||!input.trim()?0.35:1}}>
            <svg viewBox="0 0 24 24" style={{width:14,height:14,fill:"white"}}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div style={{textAlign:"center",fontSize:10,color:"#4a5568",marginTop:7}}>Yashmiq ChatBot AI · Carian web masa nyata · Jawapan tepat &amp; terkini</div>
      </div>
    </div>
  );
}
