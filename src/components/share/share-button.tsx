"use client";

import { useState } from "react";
import { ShareDialog } from "./share-dialog";
import type { ResourceType, AccessRole } from "@/lib/resource-access";

interface ShareButtonProps {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  accessRole: AccessRole;
  variant?: "icon" | "default" | "compact";
  className?: string;
}

export function ShareButton({
  resourceType,
  resourceId,
  resourceName,
  accessRole,
  variant = "default",
  className,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  if (accessRole !== "owner" && accessRole !== "editor") {
    return null;
  }

  const baseClass =
    variant === "icon"
      ? "inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      : variant === "compact"
        ? "inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        : "inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`${baseClass} ${className ?? ""}`}
        title="Compartilhar"
        aria-label="Compartilhar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={variant === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"}
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {variant !== "icon" && <span>Compartilhar</span>}
      </button>
      <ShareDialog
        open={open}
        resourceType={resourceType}
        resourceId={resourceId}
        resourceName={resourceName}
        accessRole={accessRole}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
