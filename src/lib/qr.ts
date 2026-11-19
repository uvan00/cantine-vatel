import "server-only";
import QRCode from "qrcode";

/** Le QR d'une adresse, en SVG (encre du ticket sur blanc). Sert au ticket repas : il porte `/ticket/<jeton>`. */
export const qrSvg = (url: string) =>
  QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1F1C17", light: "#FFFFFF" } });
