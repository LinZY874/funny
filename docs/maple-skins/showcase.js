const iframe=document.getElementById('skinPreview');
const versionNames={v1:'蜗牛花园',v2:'蘑菇村景',v3:'原版用色 · 蜗牛冲刺'};
let version='v3',theme='light',scene='conversation';
function syncControls(){
 document.querySelectorAll('[data-version]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.version===version)));
 document.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));
 document.querySelectorAll('[data-scene]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===scene)));
 document.getElementById('previewLabel').textContent=`冒险岛 ${version.toUpperCase()} · ${theme==='light'?'白天':'夜晚'}`;
 iframe.title=`冒险岛 ${version.toUpperCase()}（${versionNames[version]}）交互皮肤预览`;
 document.getElementById('fullscreenPreview').href=`preview.html?version=${version}&theme=${theme}&scene=${scene}`;
 document.getElementById('boostButton').disabled=version!=='v3';
 document.getElementById('boostStatus').textContent=version==='v3'?'小蜗牛正在草边散步':'蓝蜗牛冲刺是 V3 的专属互动';
}
function send(type,value){iframe.contentWindow?.postMessage({type,value},location.origin)}
document.querySelectorAll('[data-version]').forEach(button=>button.addEventListener('click',()=>{version=button.dataset.version;iframe.src=`preview.html?version=${version}&theme=${theme}&scene=${scene}`;syncControls()}));
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{theme=button.dataset.theme;send('preview-theme',theme);syncControls()}));
document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{scene=button.dataset.scene;send('preview-scene',scene);syncControls()}));
document.getElementById('boostButton').addEventListener('click',()=>send('preview-boost'));
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==iframe.contentWindow)return;if(event.data?.type==='preview-boost-count')document.getElementById('boostStatus').textContent=`小蜗牛已收到 ${event.data.count} 次助力`;});
iframe.addEventListener('load',()=>{send('preview-theme',theme);send('preview-scene',scene)});
document.getElementById('copyCommand').addEventListener('click',async event=>{const button=event.currentTarget;try{await navigator.clipboard.writeText(document.getElementById('installCommand').textContent);button.textContent='已复制'}catch{button.textContent='请选中复制'}});
syncControls();
