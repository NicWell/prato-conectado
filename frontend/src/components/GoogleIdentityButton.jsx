import { useCallback, useEffect, useRef, useState } from 'react';
import { desafioGoogleApi, GOOGLE_CLIENT_ID } from '../services/auth.js';

let gisScriptPromise;
function carregarGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisScriptPromise) {
    gisScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => window.google?.accounts?.id ? resolve() : reject(new Error('O Google Identity Services não iniciou.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o login Google. Verifique sua conexão.'));
      document.head.appendChild(script);
    }).catch((err) => { gisScriptPromise = undefined; throw err; });
  }
  return gisScriptPromise;
}
/** O challenge é obtido antes de renderizar o botão oficial. Não reutilizar nonce. */
export default function GoogleIdentityButton({ onCredential, vincular = false, disabled = false }) {
  const divRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [estado, setEstado] = useState('Preparando acesso Google...');
  const renovar = useCallback(() => setVersao(v => v + 1), []);
  useEffect(() => { callbackRef.current = onCredential; }, [onCredential]);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || disabled) return;
    let ativo = true;
    let timeout;
    (async () => {
      try {
        const desafio = await desafioGoogleApi(vincular);
        if (!ativo) return;
        await carregarGis();
        if (!ativo || !divRef.current) return;
        divRef.current.replaceChildren();
        setErro('');
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: desafio.nonce,
          auto_select: false,
          callback: async (resposta) => {
            if (!ativo || !resposta?.credential) return;
            clearTimeout(timeout);
            setEstado('Validando conta Google...');
            try { await callbackRef.current(desafio.desafio_id, resposta.credential); }
            catch (e) { if (ativo) setErro(e.message); }
            finally { if (ativo) renovar(); }
          },
        });
        window.google.accounts.id.renderButton(divRef.current, {
          theme: 'outline', size: 'large', text: vincular ? 'continue_with' : 'signin_with',
          shape: 'pill', width: Math.min(340, divRef.current.clientWidth || 340),
        });
        setEstado('');
        // O desafio dura 300 segundos no servidor: renovar com margem de segurança.
        timeout = setTimeout(renovar, 270000);
      } catch (e) {
        if (ativo) { setEstado(''); setErro(e.message); }
      }
    })();
    return () => { ativo = false; clearTimeout(timeout); };
  }, [disabled, vincular, versao, renovar]);
  if (!GOOGLE_CLIENT_ID) return <p className="field-hint">Acesso Google indisponível: configure VITE_GOOGLE_CLIENT_ID no frontend e GOOGLE_CLIENT_ID no backend.</p>;
  return <div className="google-auth-control">
    <div ref={divRef} className="google-button-container" aria-label={vincular ? 'Vincular conta Google' : 'Entrar com Google'} />
    {estado && <p className="field-hint" role="status">{estado}</p>}
    {erro && <div className="alert alert--error" role="alert">{erro} <button className="underlined" type="button" onClick={renovar}>Tentar novamente</button></div>}
  </div>;
}
