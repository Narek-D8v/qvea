import QRCode from "qrcode";

interface Props {
  value: string;
  className?: string;
}

/** QR-код рисуется на сервере в SVG — без внешних сервисов и картинок. */
export async function QrCode({ value, className = "qr" }: Props) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#131C28", light: "#FFFFFF" },
  });

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR-код: ${value}`} />
  );
}
