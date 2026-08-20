const $ = s => document.querySelector(s);
const state = { projectId: null, projects: [] };

async function api(url, options={}) {
  const r = await fetch(url, {headers:{'Content-Type':'application/json'}, ...options});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
  return data;
}

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function checkHealth(){
  try{
    const h=await api('/api/health');
    $('#providerStatus').textContent=h.gemini_configured?`${h.model} • API OK`:'Thiếu GEMINI_API_KEY';
    document.querySelector('.sidebar-foot .dot').classList.toggle('warn',!h.gemini_configured);
  }catch(e){$('#providerStatus').textContent='Không kết nối được backend';}
}

async function loadProjects(){
  const data = await api('/api/projects');
  state.projects = data.projects;
  $('#projects').innerHTML = data.projects.map(p=>`<div class="project ${p.id===state.projectId?'active':''}" data-id="${p.id}">${esc(p.name)}</div>`).join('');
  document.querySelectorAll('.project').forEach(el=>el.onclick=()=>selectProject(el.dataset.id));
}

async function selectProject(id){
  state.projectId=id; await loadProjects();
  const p = await api(`/api/projects/${id}`);
  $('#projectTitle').textContent=p.name;
  $('#prompt').disabled=false; $('#sendBtn').disabled=false; $('#deleteProject').disabled=false; $('#downloadProject').disabled=false;
  $('#status').textContent='Sẵn sàng • hỏi hoặc yêu cầu sửa code';
  renderMessages(p.messages||[]); renderFiles(p.files||[]); refreshPreview();
}

function actionMeta(m){
  if(m.role!=='assistant') return '';
  if(m.action==='build'){
    const changed=(m.written||[]).length;
    const deleted=(m.deleted||[]).length;
    const parts=[];
    if(changed) parts.push(`${changed} file đã cập nhật`);
    if(deleted) parts.push(`${deleted} file đã xóa`);
    return `<div class="action-badge build">⚡ Sửa project${parts.length?` • ${esc(parts.join(' • '))}`:''}</div>`;
  }
  if(m.action==='chat') return '<div class="action-badge chat">💬 Trả lời</div>';
  return '';
}

function renderMessages(messages){
  const box=$('#messages');
  if(!messages.length){
    box.innerHTML='<div class="empty"><div class="spark">✦</div><h2>Chat & vibe code</h2><p>Hỏi Gemini bình thường hoặc bảo nó tạo/sửa web. AI sẽ tự chọn khi nào cần thay đổi file.</p></div>';
    return;
  }
  box.innerHTML=messages.map(m=>`<div class="message ${m.role}"><div class="role">${m.role==='user'?'Bạn':'Gemini'}</div>${actionMeta(m)}<div class="message-text">${esc(m.content)}</div></div>`).join('');
  box.scrollTop=box.scrollHeight;
}

function renderFiles(files){
  $('#fileList').innerHTML=files.length?files.map(f=>`<div class="file-item" data-path="${esc(f.path)}">▧ ${esc(f.path)}</div>`).join(''):'<div class="file-item">Chưa có file</div>';
  document.querySelectorAll('.file-item[data-path]').forEach(el=>el.onclick=()=>openFile(el.dataset.path));
}

async function openFile(path){
  try{const d=await api(`/api/projects/${state.projectId}/file?path=${encodeURIComponent(path)}`);$('#fileContent').textContent=d.content;}
  catch(e){$('#fileContent').textContent=e.message;}
}

function refreshPreview(){
  if(!state.projectId)return;
  $('#previewFrame').src=`/preview/${state.projectId}/?t=${Date.now()}`;
}

$('#newProject').onclick=async()=>{
  const name=prompt('Tên project mới:','Web mới'); if(!name)return;
  try{const p=await api('/api/projects',{method:'POST',body:JSON.stringify({name})});await loadProjects();await selectProject(p.id);}catch(e){alert(e.message)}
};

$('#deleteProject').onclick=async()=>{
  if(!state.projectId||!confirm('Xóa project này?'))return;
  try{await api(`/api/projects/${state.projectId}`,{method:'DELETE'});state.projectId=null;location.reload();}catch(e){alert(e.message)}
};

$('#downloadProject').onclick=()=>{
  if(state.projectId) window.location.href=`/api/projects/${state.projectId}/download`;
};

$('#chatForm').onsubmit=async(e)=>{
  e.preventDefault(); if(!state.projectId)return;
  const message=$('#prompt').value.trim(); if(!message)return;
  const p=await api(`/api/projects/${state.projectId}`);
  renderMessages([...(p.messages||[]),{role:'user',content:message},{role:'assistant',content:'Đang suy nghĩ…'}]);
  $('#prompt').value=''; $('#prompt').disabled=true; $('#sendBtn').disabled=true; $('#status').textContent='Gemini đang xử lý…';
  try{
    const d=await api(`/api/projects/${state.projectId}/chat`,{method:'POST',body:JSON.stringify({message})});
    const updated=await api(`/api/projects/${state.projectId}`);
    renderMessages(updated.messages||[]);renderFiles(d.files||[]);
    if(d.action==='build'){
      refreshPreview();
      const n=(d.written||[]).length+(d.deleted||[]).length;
      $('#status').textContent=`Đã sửa project${n?` • ${n} thay đổi`:''} • ${d.model||'Gemini'}`;
    }else{
      $('#status').textContent=`Đã trả lời • ${d.model||'Gemini'}`;
    }
  }catch(err){alert(err.message);$('#status').textContent='Có lỗi';}
  finally{$('#prompt').disabled=false;$('#sendBtn').disabled=false;$('#prompt').focus();}
};

$('#prompt').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    if(!$('#sendBtn').disabled) $('#chatForm').requestSubmit();
  }
});

$('#refreshPreview').onclick=refreshPreview;
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  $(`#${btn.dataset.tab}Tab`).classList.add('active');
});

checkHealth();
loadProjects().catch(e=>console.error(e));
