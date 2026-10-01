(()=>{
  if(window.DartArenaDialog)return;

  if(!document.querySelector('link[data-dartarena-dialog-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='dartarena-dialog.css?v=20261002-dialog1';
    link.dataset.dartarenaDialogStyle='1';
    document.head.appendChild(link);
  }

  let queue=Promise.resolve();
  let activeLayer=null;
  let previousFocus=null;
  let previousOverflow='';

  function enqueue(factory){
    const job=queue.then(factory,factory);
    queue=job.catch(()=>{});
    return job;
  }

  function button(label,className){
    const b=document.createElement('button');
    b.type='button';
    b.className=className;
    b.textContent=label;
    return b;
  }

  function show(options={}){
    return new Promise(resolve=>{
      const mode=options.mode||'alert';
      const tone=options.tone||'info';
      const hasCancel=mode!=='alert';
      const layer=document.createElement('div');
      layer.className='da-dialog-layer';
      layer.setAttribute('role','presentation');

      const backdrop=document.createElement('div');
      backdrop.className='da-dialog-backdrop';

      const card=document.createElement('section');
      card.className='da-dialog-card';
      card.dataset.tone=tone;
      card.setAttribute('role','dialog');
      card.setAttribute('aria-modal','true');

      const kicker=document.createElement('span');
      kicker.className='da-dialog-kicker';
      kicker.textContent=options.kicker||'DARTARENA';

      const title=document.createElement('h2');
      title.className='da-dialog-title';
      title.textContent=options.title||(mode==='confirm'?'Bekreft':mode==='prompt'?'Skriv inn':'DartArena');
      const titleId='da-dialog-title-'+Math.random().toString(36).slice(2);
      title.id=titleId;
      card.setAttribute('aria-labelledby',titleId);

      const message=document.createElement('p');
      message.className='da-dialog-message';
      message.textContent=String(options.message??'');
      const messageId='da-dialog-message-'+Math.random().toString(36).slice(2);
      message.id=messageId;
      card.setAttribute('aria-describedby',messageId);

      card.append(kicker,title,message);

      let input=null;
      if(mode==='prompt'){
        const wrap=document.createElement('label');
        wrap.className='da-dialog-input-wrap';
        const label=document.createElement('span');
        label.className='da-dialog-input-label';
        label.textContent=options.inputLabel||'SVAR';
        input=document.createElement('input');
        input.className='da-dialog-input';
        input.type=options.inputType||'text';
        input.value=String(options.value??'');
        input.placeholder=options.placeholder||'';
        input.autocomplete='off';
        wrap.append(label,input);
        card.appendChild(wrap);
      }

      const actions=document.createElement('div');
      actions.className='da-dialog-actions'+(hasCancel?'':' one');
      let cancelBtn=null;
      if(hasCancel){
        cancelBtn=button(options.cancelText||'Avbryt','da-dialog-cancel');
        actions.appendChild(cancelBtn);
      }
      const confirmClass='da-dialog-confirm'+(tone==='danger'?' danger':tone==='warning'?' warning':'');
      const confirmBtn=button(options.confirmText||(mode==='alert'?'OK':'Bekreft'),confirmClass);
      actions.appendChild(confirmBtn);
      card.appendChild(actions);
      layer.append(backdrop,card);

      previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      previousOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      document.body.appendChild(layer);
      activeLayer=layer;

      let finished=false;
      const finish=value=>{
        if(finished)return;
        finished=true;
        document.removeEventListener('keydown',onKey,true);
        layer.remove();
        if(activeLayer===layer)activeLayer=null;
        document.body.style.overflow=previousOverflow;
        if(previousFocus&&document.contains(previousFocus))previousFocus.focus({preventScroll:true});
        resolve(value);
      };

      const accept=()=>finish(mode==='prompt'?input.value:true);
      const cancel=()=>finish(mode==='prompt'?null:false);
      const onKey=event=>{
        if(event.key==='Escape'&&hasCancel){event.preventDefault();cancel();return;}
        if(event.key==='Enter'){
          if(mode==='prompt'&&event.target===input){event.preventDefault();accept();return;}
          if(event.target?.tagName!=='TEXTAREA'){event.preventDefault();accept();}
        }
      };
      document.addEventListener('keydown',onKey,true);
      confirmBtn.addEventListener('click',accept);
      cancelBtn?.addEventListener('click',cancel);
      backdrop.addEventListener('click',()=>{if(options.backdropCancel!==false&&hasCancel)cancel();});

      requestAnimationFrame(()=>{
        if(input){input.focus();input.select();}
        else confirmBtn.focus();
      });
    });
  }

  const api={
    alert(message,options={}){
      return enqueue(()=>show({...options,mode:'alert',message}));
    },
    confirm(message,options={}){
      return enqueue(()=>show({...options,mode:'confirm',message}));
    },
    prompt(message,options={}){
      return enqueue(()=>show({...options,mode:'prompt',message}));
    },
    isOpen(){return !!activeLayer;}
  };

  window.DartArenaDialog=api;

  // alert() has no return value, so it can be safely themed globally.
  // confirm() and prompt() require explicit async migration at their call sites.
  window.__dartArenaNativeAlert=window.alert.bind(window);
  window.alert=message=>{api.alert(String(message??''));};
})();
