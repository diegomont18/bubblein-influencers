"use client";

import { useState } from "react";
import { ImportForm } from "@/components/enricher/import-form";
import { QueueStatus } from "@/components/enricher/queue-status";
import { ProfileTable } from "@/components/enricher/profile-table";
import { JobsTable } from "@/components/enricher/jobs-table";

export default function EnricherPage() {
  const [activeTab, setActiveTab] = useState<"profiles" | "jobs">("profiles");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile Enricher</h1>
      <div className="grid grid-cols-2 gap-6">
        <ImportForm />
        <QueueStatus />
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("profiles")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "profiles"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Profiles
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "jobs"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Queue Jobs
        </button>
      </div>
      {activeTab === "profiles" ? <ProfileTable /> : <JobsTable />}
    </div>
  );
}
