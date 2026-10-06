import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl tracking-tight">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : 23 septembre 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-xl text-foreground">1. À propos</h2>
            <p className="mt-2">
              JourneyPilot AI ("nous", "l'application") est une application de planification de voyages assistée
              par IA. Cette politique explique quelles données nous collectons, pourquoi, et comment vous pouvez
              les contrôler.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">2. Données que nous collectons</h2>
            <ul className="mt-2 list-disc space-y-1.5 ps-5">
              <li>
                <span className="text-foreground font-medium">Compte :</span> si vous créez un compte, nous
                stockons votre adresse e-mail et, si vous vous connectez avec Google, les informations de base de
                votre profil Google (nom, e-mail). Vous pouvez aussi utiliser l'application en tant qu'invité, sans
                créer de compte — une session anonyme est alors utilisée.
              </li>
              <li>
                <span className="text-foreground font-medium">Voyages :</span> les informations que vous saisissez
                pour générer un itinéraire (destination, dates, budget, style de voyage, centres d'intérêt,
                préférences alimentaires, besoins d'accessibilité) et les itinéraires générés.
              </li>
              <li>
                <span className="text-foreground font-medium">Données techniques :</span> des informations
                d'usage de base (pages visitées, type d'appareil) pour le bon fonctionnement et l'amélioration du
                service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">3. Comment nous utilisons ces données</h2>
            <p className="mt-2">Vos données servent uniquement à :</p>
            <ul className="mt-2 list-disc space-y-1.5 ps-5">
              <li>Générer et personnaliser vos itinéraires de voyage.</li>
              <li>Sauvegarder vos voyages pour que vous puissiez les retrouver sur n'importe quel appareil.</li>
              <li>Faire fonctionner et sécuriser l'application (authentification, prévention des abus).</li>
            </ul>
            <p className="mt-2">Nous ne vendons jamais vos données personnelles.</p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">4. Services tiers</h2>
            <p className="mt-2">
              Pour fonctionner, l'application partage certaines données (destination, préférences) avec les
              services suivants, uniquement dans la mesure nécessaire à la fonctionnalité concernée :
            </p>
            <ul className="mt-2 list-disc space-y-1.5 ps-5">
              <li>
                <span className="text-foreground font-medium">Supabase / Lovable Cloud</span> — hébergement de la
                base de données et de l'authentification.
              </li>
              <li>
                <span className="text-foreground font-medium">Fournisseurs de modèles IA</span> — génération du
                contenu de l'itinéraire (texte uniquement, pas de données d'identification directe).
              </li>
              <li>
                <span className="text-foreground font-medium">Google Maps / Places</span> — photos de lieux,
                informations sur les hôtels/restaurants/activités.
              </li>
              <li>
                <span className="text-foreground font-medium">OpenStreetMap (Nominatim), Photon</span> — recherche
                et suggestion de villes/pays.
              </li>
              <li>
                <span className="text-foreground font-medium">Wikimedia Commons</span> — photos de lieux sous
                licence libre.
              </li>
              <li>
                <span className="text-foreground font-medium">Google Sign-In</span> — connexion optionnelle par
                compte Google.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">5. Conservation des données</h2>
            <p className="mt-2">
              Vos voyages et votre compte sont conservés tant que vous utilisez l'application. Vous pouvez
              demander la suppression complète de vos données à tout moment (voir Contact ci-dessous).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">6. Cookies et stockage local</h2>
            <p className="mt-2">
              L'application utilise le stockage local de votre navigateur (localStorage/sessionStorage) pour
              maintenir votre session connectée, notamment via l'option "Rester connecté". Aucun cookie
              publicitaire tiers n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">7. Vos droits</h2>
            <p className="mt-2">
              Vous pouvez accéder à, corriger ou supprimer vos données, ou retirer votre consentement à tout
              moment, en nous contactant à l'adresse ci-dessous.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">8. Confidentialité des enfants</h2>
            <p className="mt-2">
              L'application ne s'adresse pas aux enfants de moins de 13 ans et ne collecte pas sciemment de
              données les concernant.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">9. Modifications</h2>
            <p className="mt-2">
              Cette politique peut être mise à jour occasionnellement. La date de dernière mise à jour figure en
              haut de cette page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-foreground">10. Contact</h2>
            <p className="mt-2">
              Pour toute question ou demande relative à vos données :{" "}
              <a href="mailto:chaouachiifiras@gmail.com" className="text-primary underline">
                chaouachiifiras@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
