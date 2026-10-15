function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node}
function makeProject(project,index){
  const card=element('article','project'),visual=element('a','project-visual');visual.href=project.url;visual.setAttribute('aria-label','打开'+project.title);
  visual.append(element('span','project-number','EXPERIMENT / '+String(index+1).padStart(3,'0')));
  const image=element('img');image.src=project.thumbnail;image.alt=project.subtitle;visual.append(image,element('span','visual-label',project.id.toUpperCase()));
  const info=element('div','project-info'),tags=element('div','tags');(project.tags||[]).forEach(tag=>tags.append(element('span','',tag)));
  info.append(tags,element('h3','',project.title),element('p','subtitle',project.subtitle),element('p','description',project.description));
  const model=element('div','model-row');model.append(element('span','','制作模型'),element('b','',project.model));info.append(model);
  const actions=element('div','project-actions'),launch=element('a','launch','开始探索'),record=element('a','record-link','提示词与模型 ↗');launch.href=project.url;launch.append(element('span','','↗'));record.href=project.record;actions.append(launch,record);info.append(actions);card.append(visual,info);return card;
}
fetch('./projects.json').then(response=>{if(!response.ok)throw new Error('作品列表不可用');return response.json()}).then(projects=>{if(!Array.isArray(projects)||!projects.length)return;document.getElementById('projectGrid').replaceChildren(...projects.map(makeProject));document.getElementById('count').textContent=String(projects.length).padStart(2,'0')}).catch(()=>{/* The static project list stays available when opening index.html directly. */});
