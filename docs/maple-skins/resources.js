const promptField=document.getElementById('v3Prompt');
const copyButton=document.getElementById('copyPrompt');
const promptStatus=document.getElementById('promptStatus');
const grid=document.getElementById('materialGrid');
const count=document.getElementById('materialCount');
let assets=[],category='all';

fetch('prompt.md').then(function(response){if(!response.ok)throw new Error('提示词不可用');return response.text()}).then(function(markdown){
  const match=markdown.match(/```text\s*\n([\s\S]*?)\n```/);
  if(!match||!match[1].trim())throw new Error('提示词内容为空');
  promptField.value=match[1].trim();copyButton.disabled=false;
  promptStatus.textContent='完整提示词已加载 · 根据真实反馈重构，非原始单次输入。';
}).catch(function(){promptField.value='暂时无法加载，请点击上方“下载 Markdown”打开完整提示词。';promptStatus.textContent='加载失败；完整提示词仍可通过 Markdown 链接获取。'});

copyButton.addEventListener('click',async function(){
  try{await navigator.clipboard.writeText(promptField.value);copyButton.textContent='已复制';promptStatus.textContent='已复制完整 V3 提示词；建议同时提供下方资料包和完整插件基线。';}
  catch{promptField.focus();promptField.select();copyButton.textContent='请手动复制';promptStatus.textContent='浏览器未允许剪贴板访问，已选中全部提示词，请按 Ctrl+C 或 ⌘C。';}
});

function node(tag,className,text){const item=document.createElement(tag);if(className)item.className=className;if(text)item.textContent=text;return item;}
function size(bytes){return bytes<1024?bytes+' B':(bytes/1024).toFixed(1)+' KB';}
function assetURL(asset){const url=new URL(asset.url,location.href);if(url.origin!==location.origin||!url.pathname.startsWith(new URL('skins/v3/assets/',location.href).pathname))throw new Error('素材路径无效');return url.href;}
function card(asset){
  const article=node('article','material-card'),visual=node('div','material-visual'),img=node('img',asset.kind);
  const url=assetURL(asset);img.src=url;img.alt=asset.name;img.loading='lazy';img.width=asset.width;img.height=asset.height;visual.append(img);
  if(asset.usage_status==='reserve')visual.append(node('span','reserve-badge','备用 / 未引用'));
  const info=node('div','material-info');info.append(node('h3','',asset.name),node('span','material-dimensions',asset.width+' × '+asset.height+' · PNG · '+size(asset.bytes)),node('p','',asset.usage));
  const actions=node('div','material-actions'),view=node('a','','打开原图 ↗'),download=node('a','','下载 PNG ↓');view.href=url;view.target='_blank';view.rel='noopener';view.setAttribute('aria-label','打开'+asset.name+'原图');download.href=url;download.download=asset.filename;download.setAttribute('aria-label','下载'+asset.name+' PNG');actions.append(view,download);info.append(actions);article.append(visual,info);return article;
}
function render(){
  const visible=assets.filter(function(asset){return category==='all'||asset.category===category;});
  grid.replaceChildren(...visible.map(card));count.textContent='显示 '+visible.length+' / '+assets.length+' 项素材';
  document.querySelectorAll('[data-category]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.category===category));});
}
document.querySelectorAll('[data-category]').forEach(function(button){button.addEventListener('click',function(){category=button.dataset.category;render();});});
fetch('materials.json').then(function(response){if(!response.ok)throw new Error('素材索引不可用');return response.json();}).then(function(data){
  if(!Array.isArray(data.assets)||!data.assets.length)throw new Error('素材列表为空');
  data.assets.forEach(assetURL);assets=data.assets;render();
}).catch(function(){count.textContent='素材列表暂时无法加载';document.getElementById('materialsStatus').prepend(document.createTextNode('请直接下载上方资料包，或'));});
