"use client";
import Image from "next/image";
import dynamic from "next/dynamic";

const FileUploadChart = dynamic(
  () => import("../components/FileUploadChart"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)]">
      <FileUploadChart />
    </div>
  );
}
