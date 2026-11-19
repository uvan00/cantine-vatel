"use client";

import { useSyncExternalStore } from "react";

const rien = () => () => {};

/**
 * Faux pendant le rendu du serveur et l'hydratation, vrai ensuite. Pour ce qui dépend de l'heure qu'il est (le trait
 * de l'heure sur la frise) : le serveur et le navigateur ne la liraient pas au même instant.
 */
export const useMonte = () => useSyncExternalStore(rien, () => true, () => false);
