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
  $('#status').textContent='Sẵn sàng';
  renderMessages(p.messages||[]); renderFiles(p.files||[]); refreshPreview();
}

function renderMessages(messages){
  const box=$('#messages');
  if(!messages.length){box.innerHTML='<div class="empty"><div class="spark">✦</div><h2>Bắt đầu build</h2><p>Hãy mô tả giao diện và chức năng bạn muốn.</p></div>';return;}
  box.innerHTML=messages.map(m=>`<div class="message ${m.role}"><div class="role">${m.role==='user'?'Bạn':'Gemini'}</div>${esc(m.content)}</div>`).join('');
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
  $('#previewFrame').src=`/preview/${state.projectId}?t=${Date.now()}`;
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
  renderMessages([...(p.messages||[]),{role:'user',content:message},{role:'assistant',content:'Đang tạo/sửa code…'}]);
  $('#prompt').value=''; $('#prompt').disabled=true; $('#sendBtn').disabled=true; $('#status').textContent='Gemini đang làm việc…';
  try{
    const d=await api(`/api/projects/${state.projectId}/chat`,{method:'POST',body:JSON.stringify({message})});
    const updated=await api(`/api/projects/${state.projectId}`);
    renderMessages(updated.messages||[]);renderFiles(d.files||[]);refreshPreview();$('#status').textContent=`Hoàn tất • ${d.model||'Gemini'}`;
  }catch(err){alert(err.message);$('#status').textContent='Có lỗi';}
  finally{$('#prompt').disabled=false;$('#sendBtn').disabled=false;$('#prompt').focus();}
};

$('#refreshPreview').onclick=refreshPreview;
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  $(`#${btn.dataset.tab}Tab`).classList.add('active');
});

checkHealth();
loadProjects().catch(e=>console.error(e));
