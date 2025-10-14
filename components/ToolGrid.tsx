import AdSlot from "@/components/ads/AdSlot";
import ToolCard from "./ToolCard";
import {
  Scissors, Youtube, FileCode2, Images, FileText, Lock, AudioLines, Box
} from "lucide-react";

export const tools = [
  { href: "/tools/background-remover", title: "Background Remover", desc: "AI cutouts in seconds — PNG with transparency.", Icon: Scissors },
  { href: "/tools/youtube-downloader", title: "YouTube → MP3/MP4/WAV", desc: "Paste a link. Download audio/video cleanly.", Icon: Youtube },
  { href: "/tools/file-converter", title: "File Converter", desc: "Convert anything → anything. Images, docs, media.", Icon: FileCode2 },
  { href: "/tools/image-tools", title: "Image Tools", desc: "Resize, compress, swap formats — JPG, PNG, WEBP.", Icon: Images },
  { href: "/tools/pdf-tools", title: "PDF Suite", desc: "Merge, split, compress, sign, OCR, redact.", Icon: FileText },
  { href: "/tools/audio-tools", title: "Audio Tools", desc: "Trim, normalize, convert formats like FLAC/MP3.", Icon: AudioLines },
  { href: "/tools/archive", title: "Archive Tools", desc: "Zip/Unzip, TAR, 7z, password encrypt archives.", Icon: Box },
  { href: "/tools/security", title: "Security Utils", desc: "Hash/verify (SHA256, MD5), password gen, checksum.", Icon: Lock }
];

export default function ToolGrid({ injectEvery = 8 }: { injectEvery?: number }) {
  const items: React.ReactNode[] = [];

  for (let i = 0; i < tools.length; i++) {
    items.push(<ToolCard key={tools[i].href} {...tools[i]} />);
    if (i > 0 && (i + 1) % injectEvery === 0) {
      items.push(
        <div
          key={`ad-${i}`}
          className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 flex justify-center"
        >
          <AdSlot id={`grid-mid-${i}`} width={970} height={90} render="adsense" />
        </div>
      );
    }
  }

  return (
    <section className="mx-auto mt-8 grid max-w-7xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items}
    </section>
  );
}
