var TranslationCore = (() => {
  function splitText(text, limit) {
    const parts=[]; let remaining=text.trim();
    while (remaining.length>limit) {
      const prefix=remaining.slice(0,limit);
      const boundaries=[...prefix.matchAll(/(?:\n\s*\n|[.!?。！？;；]\s+)/g)];
      let end=boundaries.length ? boundaries.at(-1).index+boundaries.at(-1)[0].length : prefix.lastIndexOf(' ')+1;
      if(end<limit/2) end=limit;
      // Avoid splitting a Unicode surrogate pair.
      if(/[\uD800-\uDBFF]/.test(remaining[end-1])) end--;
      parts.push(remaining.slice(0,end).trim());remaining=remaining.slice(end).trim();
    }
    if(remaining) parts.push(remaining);
    return parts;
  }
  function sseParser(onEvent) {
    let buffer='',done=false;
    function consume(line) {
      if(!line.startsWith('data:')) return;
      const data=line.slice(5).trim();
      if(data==='[DONE]'){done=true;return;}
      if(!data) return;
      onEvent(JSON.parse(data));
    }
    return {
      push(text,final=false) {
        buffer+=text;
        const lines=buffer.split(/\r?\n/);buffer=lines.pop();
        for(const line of lines) consume(line);
        if(final&&buffer.trim()){consume(buffer);buffer='';}
      },
      get done(){return done;}
    };
  }
  return {splitText,sseParser};
})();
