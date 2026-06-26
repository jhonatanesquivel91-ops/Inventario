import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (datos: any) => void;
  activoParaEditar?: any; // Si viene, es modo edición
}

export default function FormularioActivoModal({ isOpen, onClose, onSave, activoParaEditar }: Props) {
  // Estados para los selectores dependientes (Estructura Padre > Hijo)
  const [tipoHardware, setTipoHardware] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serie, setSerie] = useState('');

  // Datos mock/Supabase para la demostración de la cascada
  const tiposDisponibles = ['Laptop', 'Monitor', 'Teclado'];
  const marcasPorTipo: Record<string, string[]> = {
    Laptop: ['HP', 'Dell', 'Lenovo'],
    Monitor: ['LG', 'Samsung', 'Dell'],
    Teclado: ['Logitech', 'Genius'],
  };
  const modelosPorMarca: Record<string, string[]> = {
    HP: ['ProBook 450 G8', 'EliteBook 840'],
    Dell: ['Latitude 5420', 'UltraSharp 24"'],
    Lenovo: ['ThinkPad T14'],
    LG: ['24MK430H'],
    Samsung: ['T35F'],
    Logitech: ['K120', 'MX Keys'],
  };

  // Efecto para precargar datos si es edición
  useEffect(() => {
    if (activoParaEditar) {
      setTipoHardware(activoParaEditar.tipo || '');
      setMarca(activoParaEditar.marca || '');
      setModelo(activoParaEditar.modelo || '');
      setSerie(activoParaEditar.serie || '');
    } else {
      // Limpiar si es un alta nueva
      setTipoHardware('');
      setMarca('');
      setModelo('');
      setSerie('');
    }
  }, [activoParaEditar, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[#1E293B] mb-4">
          {activoParaEditar ? '✏️ Editar Activo TI' : '📦 Registrar Nuevo Activo'}
        </h2>

        <form onSubmit={(e) => { e.preventDefault(); onSave({ tipoHardware, marca, modelo, serie }); }} className="space-y-4">
          
          {/* 1. TIPO DE HARDWARE (PADRE) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Hardware</label>
            <select
              value={tipoHardware}
              onChange={(e) => { setTipoHardware(e.target.value); setMarca(''); setModelo(''); }}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-[rgb(1,71,118)] outline-none"
              required
            >
              <option value="">Seleccione tipo...</option>
              {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 2. MARCA (DEPENDIENTE DEL TIPO) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <select
              value={marca}
              onChange={(e) => { setMarca(e.target.value); setModelo(''); }}
              disabled={!tipoHardware}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-[rgb(1,71,118)] outline-none disabled:bg-gray-100"
              required
            >
              <option value="">Seleccione marca...</option>
              {tipoHardware && marcasPorTipo[tipoHardware]?.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* 3. MODELO (DEPENDIENTE DE LA MARCA) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
            <select
              value={modelo}
              disabled={!marca}
              onChange={(e) => setModelo(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-[rgb(1,71,118)] outline-none disabled:bg-gray-100"
              required
            >
              <option value="">Seleccione modelo...</option>
              {marca && modelosPorMarca[marca]?.map(mod => <option key={mod} value={mod}>{mod}</option>)}
            </select>
          </div>

          {/* OTRAS PROPIEDADES (Ejemplo: Serie) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de Serie</label>
            <input
              type="text"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              placeholder="A1B2C3D4"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-[rgb(1,71,118)] outline-none"
              required
            />
          </div>

          {/* BOTONES ACCIÓN */}
          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[rgb(1,71,118)] text-white rounded-md hover:bg-opacity-90 transition"
            >
              {activoParaEditar ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}