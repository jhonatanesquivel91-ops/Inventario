'use client';

import React, { useMemo } from 'react';
import { ModalBase } from './ModalBase';

interface ModalFormularioActivoProps {
  isOpen: boolean;
  onClose: () => void;
  modo: 'alta' | 'edicion';
  activo?: any;
  onSubmit: (e: React.FormEvent) => void;
  guardando: boolean;
  condicionesCatalogo: any[];
  categoriasCatalogo: any[];
  marcasCatalogo: any[];
  modelosCatalogo: any[];
  
  // Estados vinculados
  formTipo: string; setFormTipo: (v: string) => void;
  formMarca: string; setFormMarca: (v: string) => void;
  formModelo: string; setFormModelo: (v: string) => void;
  formSerie: string; setFormSerie: (v: string) => void;
  formCaf: string; setFormCaf: (v: string) => void;
  formSpecs: string; setFormSpecs: (v: string) => void;
  formCondicion: string; setFormCondicion: (v: string) => void;
  formTipoPropiedad: 'Compra' | 'Alquiler'; setFormTipoPropiedad: (v: 'Compra' | 'Alquiler') => void;
  formFechaFinAlquiler: string; setFormFechaFinAlquiler: (v: string) => void;

  // Estados inline creadores
  creandoNuevaFamilia: boolean; setCreandoNuevaFamilia: (b: boolean) => void;
  nuevaFamiliaNombre: string; setNuevaFamiliaNombre: (v: string) => void;
  creandoNuevaMarca: boolean; setCreandoNuevaMarca: (b: boolean) => void;
  nuevaMarcaNombre: string; setNuevaMarcaNombre: (v: string) => void;
  creandoNuevoModelo: boolean; setCreandoNuevoModelo: (b: boolean) => void;
  nuevoModeloNombre: string; setNuevoModeloNombre: (v: string) => void;
}

export function ModalFormularioActivo({
  isOpen, onClose, modo, guardando, condicionesCatalogo, categoriasCatalogo, marcasCatalogo, modelosCatalogo,
  formTipo, setFormTipo, formMarca, setFormMarca, formModelo, setFormModelo, formSerie, setFormSerie,
  formCaf, setFormCaf, formSpecs, setFormSpecs, formCondicion, setFormCondicion, formTipoPropiedad, setFormTipoPropiedad,
  formFechaFinAlquiler, setFormFechaFinAlquiler, creandoNuevaFamilia, setCreandoNuevaFamilia, nuevaFamiliaNombre, setNuevaFamiliaNombre,
  creandoNuevaMarca, setCreandoNuevaMarca, nuevaMarcaNombre, setNuevaMarcaNombre, creandoNuevoModelo, setCreandoNuevoModelo, nuevoModeloNombre, setNuevoModeloNombre,
  onSubmit
}: ModalFormularioActivoProps) {

  // Lógica de filtrado en cascada encapsulada
  const marcasFiltradasBD = useMemo(() => {
    if (!formTipo) return [];
    const cat = categoriasCatalogo.find(c => String(c.nombre_categoria).toLowerCase().trim() === formTipo.toLowerCase().trim());
    if (!cat) return [];
    return Array.from(new Set(marcasCatalogo.filter(m => Number(m.categoria_id) === Number(cat.id)).map(m => m.nombre_marca))).sort();
  }, [marcasCatalogo, categoriasCatalogo, formTipo]);

  const modelosFiltradosBD = useMemo(() => {
    if (!formMarca || !formTipo) return [];
    const cat = categoriasCatalogo.find(c => String(c.nombre_categoria).toLowerCase().trim() === formTipo.toLowerCase().trim());
    if (!cat) return [];
    const marca = marcasCatalogo.find(m => String(m.nombre_marca).toLowerCase().trim() === formMarca.toLowerCase().trim() && Number(m.categoria_id) === Number(cat.id));
    if (!marca) return [];
    return Array.from(new Set(modelosCatalogo.filter(mod => Number(mod.marca_id) === Number(marca.id)).map(mod => mod.nombre_modelo))).sort();
  }, [modelosCatalogo, marcasCatalogo, formMarca, formTipo, categoriasCatalogo]);

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} titulo={modo === 'alta' ? "➕ Registrar Nuevo Activo" : "✏️ Modificar Parámetros de Activo"}>
      <form onSubmit={onSubmit} className="space-y-4 text-xs font-medium text-slate-600">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Familia Hardware *</label>
            <select 
              value={creandoNuevaFamilia ? 'NUEVA_FAMILIA' : formTipo} 
              onChange={(e) => {
                if (e.target.value === 'NUEVA_FAMILIA') { setCreandoNuevaFamilia(true); setFormTipo(''); }
                else { setCreandoNuevaFamilia(false); setFormTipo(e.target.value); }
              }} 
              className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none border-slate-200 text-xs shadow-sm cursor-pointer"
              required={!creandoNuevaFamilia}
            >
              <option value="">Seleccione una familia...</option>
              {categoriasCatalogo.map((cat, index) => <option key={`${cat.id || index}`} value={cat.nombre_categoria}>{cat.nombre_categoria}</option>)}
              <option value="NUEVA_FAMILIA" className="text-blue-700 font-bold">➕ Agregar nueva familia...</option>
            </select>
            {creandoNuevaFamilia && (
              <input type="text" value={nuevaFamiliaNombre} onChange={(e) => setNuevaFamiliaNombre(e.target.value)} placeholder="Escribe la nueva familia..." className="w-full mt-1.5 p-1.5 border border-blue-300 rounded-lg outline-none font-bold text-slate-800 bg-blue-50/30 text-xs animate-fade-in" required />
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Fabricante (Marca) *</label>
            <select 
              value={creandoNuevaMarca ? 'NUEVA_MARCA' : formMarca} 
              onChange={(e) => {
                if (e.target.value === 'NUEVA_MARCA') { setCreandoNuevaMarca(true); setFormMarca(''); }
                else { setCreandoNuevaMarca(false); setFormMarca(e.target.value); }
              }} 
              className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none border-slate-200 text-xs shadow-sm cursor-pointer"
              required={!creandoNuevaMarca}
              disabled={!formTipo && !creandoNuevaFamilia}
            >
              <option value="">Seleccione una marca...</option>
              {marcasFiltradasBD.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="NUEVA_MARCA" className="text-blue-700 font-bold">➕ Agregar nueva marca...</option>
            </select>
            {creandoNuevaMarca && (
              <input type="text" value={nuevaMarcaNombre} onChange={(e) => setNuevaMarcaNombre(e.target.value)} placeholder="Escribe la nueva marca..." className="w-full mt-1.5 p-1.5 border border-blue-300 rounded-lg outline-none font-bold text-slate-800 bg-blue-50/30 text-xs animate-fade-in" required />
            )}
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Modelo Técnico *</label>
          <select 
            value={creandoNuevoModelo ? 'NUEVO_MODELO' : formModelo} 
            onChange={(e) => {
              if (e.target.value === 'NUEVO_MODELO') { setCreandoNuevoModelo(true); setFormModelo(''); }
              else { setCreandoNuevoModelo(false); setFormModelo(e.target.value); }
            }} 
            className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none border-slate-200 text-xs shadow-sm cursor-pointer"
            required={!creandoNuevoModelo}
            disabled={!formMarca && !creandoNuevaMarca}
          >
            <option value="">Seleccione un modelo...</option>
            {modelosFiltradosBD.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="NUEVO_MODELO" className="text-blue-700 font-bold">➕ Agregar nuevo modelo...</option>
          </select>
          {creandoNuevoModelo && (
            <input type="text" value={nuevoModeloNombre} onChange={(e) => setNuevoModeloNombre(e.target.value)} placeholder="Escribe el nuevo modelo técnico..." className="w-full mt-1.5 p-2 border border-blue-300 rounded-lg outline-none font-bold text-slate-800 bg-blue-50/30 text-xs animate-fade-in" required />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Número de Serie *</label>
            <input type="text" value={formSerie} onChange={(e) => setFormSerie(e.target.value)} placeholder="S/N único" className="w-full p-2 border rounded-lg outline-none font-mono font-bold text-slate-800 bg-white" required />
          </div>
          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Código CAF</label>
            <input type="text" value={formCaf} onChange={(e) => setFormCaf(e.target.value)} placeholder="Ej: CAF-021" className="w-full p-2 border rounded-lg outline-none font-mono font-bold text-slate-800" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 border rounded-xl">
          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Régimen Inmueble/Bien *</label>
            <select value={formTipoPropiedad} onChange={(e) => setFormTipoPropiedad(e.target.value as 'Compra' | 'Alquiler')} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none">
              <option value="Compra">💼 Compra</option>
              <option value="Alquiler">💼 Alquiler</option>
            </select>
          </div>
          <div>
            <label className={`block font-bold uppercase text-[10px] mb-1 ${formTipoPropiedad === 'Alquiler' ? 'text-purple-600 font-black' : 'text-slate-400'}`}>Fin de Contrato {formTipoPropiedad === 'Alquiler' && '*'}</label>
            <input type="date" value={formFechaFinAlquiler} onChange={(e) => setFormFechaFinAlquiler(e.target.value)} disabled={formTipoPropiedad === 'Compra'} className={`w-full p-1.5 border rounded-lg outline-none font-mono font-bold text-xs ${formTipoPropiedad === 'Compra' ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-purple-900 border-purple-300'}`} required={formTipoPropiedad === 'Alquiler'} />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Estado de Conservación Física</label>
          <select value={formCondicion} onChange={(e) => setFormCondicion(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 outline-none text-xs shadow-sm">
            {condicionesCatalogo.map((c) => <option key={c.id} value={c.nombre_estado}>{c.nombre_estado}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Especificaciones Técnicas</label>
          <input type="text" value={formSpecs} onChange={(e) => setFormSpecs(e.target.value)} placeholder="Ej: Core i5, 16GB RAM, 512GB SSD" className="w-full p-2 border rounded-lg outline-none text-slate-800" />
        </div>

        <button type="submit" disabled={guardando} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="w-full py-2.5 text-white font-black rounded-xl uppercase tracking-wider">
          {guardando ? "Sincronizando..." : "💾 Sincronizar Registro"}
        </button>
      </form>
    </ModalBase>
  );
}