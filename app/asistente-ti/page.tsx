'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Mensaje {
  role: 'user' | 'bot';
  content: string;
}

export default function ChatbotTI() {
  const [messages, setMessages] = useState<Mensaje[]>([
    { role: 'bot', content: 'Hola Jonathan. Bienvenido al **Centro de Inteligencia TI - Posgrado UPeU**. El sistema ha sido migrado al motor estable **Gemini 1.5-Flash** con sincronización total de la base de datos de Supabase en tiempo real.\n\nPuedes consultarme libremente sobre stock, fallas o estados del inventario. ¿En qué te asisto hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const nuevosMensajes = [...messages, { role: 'user', content: userText } as Mensaje];
    setMessages(nuevosMensajes);
    setLoading(true);

    try {
      // Filtramos para que el historial que va a Google inicie siempre con el usuario
      const historialFiltrado = nuevosMensajes.filter((m, index) => {
        if (index === 0 && m.role === 'bot') return false;
        return true;
      }).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content
      }));

      const res = await fetch('/api/gemini-ti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historialFiltrado })
      });

      const data = await res.json();
      
      if (res.ok || data.texto.includes('⚠️')) {
        setMessages([...nuevosMensajes, { role: 'bot', content: data.texto }]);
      } else {
        setMessages([...nuevosMensajes, { role: 'bot', content: `❌ Error: ${data.texto}` }]);
      }
    } catch (err) {
      setMessages([...nuevosMensajes, { role: 'bot', content: '❌ No se pudo conectar con el servidor local.' }]);
    } finally {
      setLoading(false);
    }
  };

  const reiniciarChat = () => {
    if (window.confirm("¿Seguro que deseas limpiar el historial de la conversación?")) {
      setMessages([
        { role: 'bot', content: 'Historial reiniciado. Hola Jonathan, ¿en qué te puedo asistir con el control de inventario actual?' }
      ]);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-slate-100 text-slate-800">
      
      {/* HEADER BAR */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'rgb(1, 71, 118)' }}>
            🤖 Consola Virtual TI Posgrado
          </h1>
          <p className="text-[10px] text-slate-500 font-medium">Asistente en tiempo real conectado al inventario general de activos UPeU.</p>
        </div>
        
        <button 
          type="button" 
          onClick={reiniciarChat}
          className="text-xs bg-slate-100 hover:bg-red-50 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 font-bold transition-all"
        >
          🔄 Reiniciar Chat
        </button>
      </div>

      {/* CUERPO DEL CHAT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl px-4 py-3 rounded-2xl shadow-sm text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-800 border rounded-bl-none font-sans'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-200 text-slate-500 px-4 py-2 rounded-2xl text-[10px] font-mono animate-pulse">
              🤖 Consultando Supabase e inyectando contexto...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* BARRA DE INPUT INFERIOR */}
      <div className="bg-white p-4 border-t">
        <form onSubmit={enviarMensaje} className="max-w-4xl mx-auto flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Escribe tu consulta aquí (Ej: Muéstrame qué laptops están en soporte)..." 
            className="flex-1 px-4 py-2.5 border rounded-xl bg-slate-50 text-xs focus:bg-white outline-none text-slate-800 font-medium"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            style={{ backgroundColor: 'rgb(1, 71, 118)' }}
            className="px-5 text-white font-bold text-xs rounded-xl shadow disabled:opacity-40 transition-all hover:brightness-110"
          >
            Enviar
          </button>
        </form>
      </div>

    </main>
  );
}