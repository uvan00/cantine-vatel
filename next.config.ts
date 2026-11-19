import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // Sortie autonome : l'image Docker n'embarque que ce qui sert à lancer le serveur.
  output: "standalone",
  // Les téléphones ouvrent le serveur de développement par l'adresse wifi de l'ordinateur (192.168.x.x, 10.x.x.x, ou
  // 172.x.x.x sur un partage de connexion). Sans cette liste, Next leur refuse ses ressources de développement : la page
  // s'affiche mais reste figée, rien ne réagit au doigt. Sans effet sur `npm start`.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "127.0.0.1"],
};

export default nextConfig;
