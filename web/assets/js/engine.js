// .NET WebAssembly motorunu yükler ve JavaScript'ten çağrılabilir fonksiyonlarını döndürür.

let enginePromise = null;
let host = null;

/** Motorun arayüz çağrılarını (form çizimi, mesaj kutusu...) karşılayan nesneyi ayarlar. */
export function setHost(h) {
  host = h;
}

const noHost = (name) => () => {
  console.warn('Motor çağrısı için arayüz yok:', name);
  return '';
};

function call(name, ...args) {
  const fn = host?.[name];
  if (!fn) return noHost(name)();
  return fn.apply(host, args);
}

/**
 * Motoru yükler. İlk çağrıda indirme yapılır (~11 MB, sonra tarayıcı önbelleğinden gelir).
 * @param {(loaded:number,total:number)=>void} onProgress
 */
export function loadEngine(onProgress) {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const base = new URL('../../_framework/', import.meta.url);
    const { dotnet } = await import(new URL('dotnet.js', base).href);
    const runtime = await dotnet
      .withApplicationCulture('tr-TR')
      .withConfig({ loadAllSatelliteResources: true })
      .withModuleConfig({
        onDownloadResourceProgress: (loaded, total) => onProgress?.(loaded, total),
      })
      .create();

    runtime.setModuleImports('ui', {
      applyOps: (json) => call('applyOps', json),
      scheduleFlush: () => call('scheduleFlush'),
      measure: (text, font) => call('measure', text, font) || '0,0',
      messageBox: (text, caption, buttons, icon) => call('messageBox', text, caption, buttons, icon) || 'OK',
      inputBox: (prompt, title, def) => call('inputBox', prompt, title, def),
      showDialog: (id, kind, json) => call('showDialog', id, kind, json),
      query: (id, what) => String(call('query', id, what) ?? ''),
      output: (text) => call('output', text),
      error: (json) => call('error', json),
      programEnded: (reason) => call('programEnded', reason),
    });

    await runtime.runMain();
    const exports = await runtime.getAssemblyExports('CLesson.Engine.dll');
    return exports.CLesson.Engine.Interop;
  })();
  enginePromise.catch(() => { enginePromise = null; });
  return enginePromise;
}
