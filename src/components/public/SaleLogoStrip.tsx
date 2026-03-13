"use client";

import Image from "next/image";

/**
 * แถบโลโก้คลินิกความงามในไทย (ชื่อและโลโก้จริง จากเว็บไซต์ทางการ)
 * เลื่อนขวา→ซ้าย, Hover = หยุดเลื่อน
 */
const PARTNERS: { name: string; logo: string }[] = [
  {
    name: "โรงพยาบาลเลอลักษณ์ (Lelux)",
    logo: "https://www.lelux.co.th/wp-content/uploads/2023/04/Logo-3-e1726031441392.png",
  },
  {
    name: "LABX Clinic",
    logo: "https://labxclinic.com/wp-content/uploads/2025/04/LABX-transperant.png",
  },
  {
    name: "โรงพยาบาลเลอลักษณ์ (Lelux)",
    logo: "https://www.lelux.co.th/wp-content/uploads/2023/04/Logo-3-e1726031441392.png",
  },
  {
    name: "LABX Clinic",
    logo: "https://labxclinic.com/wp-content/uploads/2025/04/LABX-transperant.png",
  },
];

function PartnerLogo({ name, logo }: { name: string; logo: string }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border shadow-sm transition-shadow duration-300 hover:shadow-[var(--sale-shadow-lg)]"
      style={{ borderColor: "var(--sale-border)" }}
      title={name}
    >
      <div className="relative w-[120px] h-12 flex items-center justify-center">
        <Image
          src={logo}
          alt={name}
          width={120}
          height={48}
          className="object-contain object-center max-h-12 w-auto"
          unoptimized={false}
        />
      </div>
      <span className="text-sm font-medium whitespace-nowrap hidden sm:inline" style={{ color: "var(--sale-text-muted)" }}>
        {name}
      </span>
    </div>
  );
}

export function SaleLogoStrip() {
  const list = (
    <>
      {PARTNERS.map((p, i) => (
        <PartnerLogo key={`${p.name}-${i}`} name={p.name} logo={p.logo} />
      ))}
    </>
  );

  return (
    <section className="py-10 overflow-hidden" aria-label="คลินิกความงามในไทย">
      <p className="text-center text-sm font-medium tracking-wide mb-6" style={{ color: "var(--sale-text-muted)" }}>
        คลินิกความงามและศัลยกรรมความงามในประเทศไทย
      </p>
      <div className="relative">
        <div className="overflow-hidden py-2">
          <div
            className="sale-logo-track flex flex-nowrap items-center gap-8 w-max"
            style={{ width: "max-content" }}
          >
            <div className="flex items-center gap-8 pr-8">{list}</div>
            <div className="flex items-center gap-8 pr-8" aria-hidden>
              {list}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
