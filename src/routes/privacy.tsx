import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/layout/AppHeader";
import { privacyPolicyFor } from "@/lib/privacy-policy";

const CONTACT_EMAIL = "chaouachiifiras@gmail.com";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  const { i18n } = useTranslation();
  const policy = privacyPolicyFor(i18n.language);

  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl tracking-tight">{policy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{policy.updated}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          {policy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-xl text-foreground">{section.title}</h2>
              {section.blocks.map((block, i) =>
                "text" in block ? (
                  <p key={i} className="mt-2">
                    {block.text}
                    {section.email && (
                      <>
                        {" "}
                        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                          {CONTACT_EMAIL}
                        </a>
                      </>
                    )}
                  </p>
                ) : (
                  <ul key={i} className="mt-2 list-disc space-y-1.5 ps-5">
                    {block.items.map((item) => (
                      <li key={item.text}>
                        {item.label && <span className="text-foreground font-medium">{item.label}</span>} {item.text}
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
