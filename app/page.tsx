import { redirect } from 'next/navigation';

/**
 * La raíz no tiene contenido propio: el sistema entra por la pantalla que más
 * se usa. Antes aquí seguía la plantilla de ejemplo de Next.js.
 */
export default function Inicio() {
  redirect('/asignaciones/alta');
}
