"use client";

import { useState } from "react";
import PostsFreqBadge from "./posts-freq-badge";

interface EmpData { name: string; slug: string; headline: string; linkedinUrl: string; profilePicUrl: string; archived?: boolean }

export default function CompetitorEmployees({
  companyName: _companyName,
  employees,
  onUpdate,
}: {
  companyName: string;
  employees: EmpData[];
  onUpdate: (employees: EmpData[]) => void;
}) {
  const [addingSlug, setAddingSlug] = useState("");

  const activeEmployees = employees.filter(e => !e.archived);
  const archivedEmployees = employees.filter(e => e.archived);

  return (
    <div className="mt-2 ml-12 space-y-1.5">
      <p className="text-[10px] text-white/30 uppercase tracking-wider">
        Executivos ({activeEmployees.length})
      </p>
      {activeEmployees.map((emp) => {
        const empPending = !emp.headline && !emp.profilePicUrl;
        return (
        <div key={emp.slug} className={`flex items-center gap-2 bg-white/[0.02] border rounded-lg px-3 py-1.5 group/emp ${empPending ? "border-[#f59e0b]/20" : "border-white/[0.06]"}`}>
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-white/10">
            {emp.profilePicUrl ? (
              <img src={emp.profilePicUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${empPending ? "text-[#f59e0b]/60" : "text-white/40"}`}>
                {emp.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <a href={emp.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/80 font-medium truncate hover:text-[#ca98ff] transition-colors">{emp.name}</a>
              {empPending && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-[#f59e0b] bg-[#f59e0b]/10">Pendente</span>}
              {!empPending && <PostsFreqBadge ppm={(emp as unknown as Record<string,unknown>).postsPerMonth as number | undefined} />}
            </div>
            {emp.headline ? <p className="text-[10px] text-white/30 truncate">{emp.headline.slice(0, 50)}</p> : <p className="text-[10px] text-white/20 italic">Clique Processar na empresa</p>}
          </div>
          <button
            onClick={() => onUpdate(employees.map((e) => e.slug === emp.slug ? { ...e, archived: true } : e))}
            className="w-5 h-5 rounded-full bg-white/5 hover:bg-[#ff946e]/20 text-white/20 hover:text-[#ff946e] flex items-center justify-center text-xs font-bold shrink-0 transition-colors opacity-0 group-hover/emp:opacity-100"
            title="Arquivar"
          >
            &times;
          </button>
        </div>
        );
      })}
      {archivedEmployees.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] text-white/25 hover:text-white/40 select-none flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
            {archivedEmployees.length} executivo(s) arquivado(s)
          </summary>
          <div className="mt-1 space-y-1">
            {archivedEmployees.map((emp) => (
              <div key={emp.slug} className="flex items-center gap-2 bg-white/[0.01] border border-white/[0.04] rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-white/10">
                  {emp.profilePicUrl ? (
                    <img src={emp.profilePicUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white/30">
                      {emp.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/40 font-medium truncate">{emp.name}</p>
                  {emp.headline && <p className="text-[9px] text-white/20 truncate">{emp.headline.slice(0, 50)}</p>}
                </div>
                <PostsFreqBadge ppm={(emp as unknown as Record<string,unknown>).postsPerMonth as number | undefined} />
                <button
                  onClick={() => onUpdate(employees.map((e) => e.slug === emp.slug ? { ...e, archived: false } : e))}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-[#ca98ff]/10 text-[#ca98ff] hover:bg-[#ca98ff]/20 transition-colors shrink-0"
                >+ Adicionar</button>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={addingSlug}
          onChange={(e) => setAddingSlug(e.target.value)}
          placeholder="linkedin.com/in/slug"
          className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-white placeholder-white/15 outline-none focus:border-[#ca98ff]/30 transition-colors"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !addingSlug.trim()) return;
            const slug = addingSlug.trim().match(/\/in\/([^/?#]+)/)?.[1] ?? addingSlug.trim();
            onUpdate([...employees, { name: slug, slug, headline: "", linkedinUrl: `https://www.linkedin.com/in/${slug}`, profilePicUrl: "" }]);
            setAddingSlug("");
          }}
        />
      </div>
    </div>
  );
}
