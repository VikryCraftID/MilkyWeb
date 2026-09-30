const btn=document.getElementById('btn'), url=document.getElementById('url'), type=document.getElementById('type'), status=document.getElementById('status'), result=document.getElementById('result'), dl=document.getElementById('dl'), info=document.getElementById('info');

btn.onclick=async()=>{
  const u=url.value.trim();
  if(!u) return status.textContent='Masukkan URL dulu';
  btn.disabled=true;
  status.textContent='Memproses...';
  result.classList.add('hidden');
  try{
    const res=await fetch('/api/download',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:u, type:type.value})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Gagal');
    if(data.direct && data.url){
      dl.href=data.url; dl.download=''; info.textContent=`${data.platform.toUpperCase()} · ${data.type.toUpperCase()} · Direct CDN`;
      result.classList.remove('hidden'); status.textContent='Siap download';
    } else if(data.data){
      const blob=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));
      const b=new Blob([blob],{type: type.value==='mp3'?'audio/mpeg':'video/mp4'});
      const obj=URL.createObjectURL(b);
      dl.href=obj; dl.download=data.fileName||`media.${type.value}`; info.textContent=`${data.platform} · ${data.type}`;
      result.classList.remove('hidden'); status.textContent='Siap download';
    } else {
      throw new Error('No data');
    }
  }catch(e){
    status.textContent='Error: '+(e.message||'Gagal');
  } finally{ btn.disabled=false; }
};
