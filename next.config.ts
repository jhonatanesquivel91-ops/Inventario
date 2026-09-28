import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en la carpeta del usuario de Windows; sin
  // esto Next lo toma como raíz del proyecto y el servidor de desarrollo falla
  // al resolver módulos ("Cannot find module @swc/helpers...").
  turbopack: {
    root: path.join(__dirname),
  },
  // IPs de la red local desde las que se abre la app en el celular.
  allowedDevOrigins: [
    "192.168.66.32",
    "192.168.0.100",
    "localhost"
  ]
};

export default nextConfig;
