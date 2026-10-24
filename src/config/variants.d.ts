export type Variant = "development" | "preview" | "production";

export type VariantShape = {
  /** Ce qui s'ajoute au bundle identifier : `.dev`, `.preview`, ou rien. */
  suffix: string;
  /** Le nom sur l'écran d'accueil. */
  name: string;
  /** Le schéma d'URL, qui porte les retours de connexion et de mot de passe. */
  scheme: string;
};

export declare const VARIANTS: Record<Variant, VariantShape>;

export declare function variantOf(raw: string | undefined): Variant;
