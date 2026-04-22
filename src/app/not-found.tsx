import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white flex flex-col items-center justify-center px-6">
      <Image src="/logo.png" alt="BubbleIn" width={120} height={43} className="mb-10" />

      <div className="text-center max-w-md">
        <h1 className="text-7xl font-extrabold bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent mb-4">
          404
        </h1>
        <h2 className="text-2xl font-bold text-white mb-4">
          Página não encontrada
        </h2>
        <p className="text-gray-400 mb-8 leading-relaxed">
          A página que você está procurando não existe ou foi movida. Verifique o endereço ou volte para a página inicial.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] text-[#1a0033] font-semibold px-8 py-3 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Voltar ao início
          </Link>
          <Link
            href="/casting/share-of-linkedin"
            className="inline-block border border-[#ca98ff]/30 text-[#ca98ff] font-semibold px-8 py-3 rounded-full text-sm hover:bg-[#ca98ff]/10 transition-colors"
          >
            Leads Generation
          </Link>
        </div>
      </div>

      <div className="absolute -top-20 right-[10%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[5%] w-60 h-60 bg-[#C724D1]/5 rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
}
