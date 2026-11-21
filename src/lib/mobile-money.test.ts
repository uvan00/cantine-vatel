// Essais du Mobile Money de Côte d'Ivoire : le numéro, les opérateurs, les messages. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { messageOperateur, nomOperateur, operateursIvoiriens, saisieNumero, telephoneCartflox, telephoneIvoirien } from "./mobile-money.ts";

test("un numéro de Côte d'Ivoire se ramène à ses 10 chiffres", () => {
  assert.equal(telephoneIvoirien("07 07 07 07 07"), "0707070707");
  assert.equal(telephoneIvoirien("+225 07 07 07 07 07"), "0707070707");
  assert.equal(telephoneIvoirien("2250505050505"), "0505050505");
  assert.equal(telephoneIvoirien("00225 0101010101"), "0101010101");
  assert.equal(telephoneIvoirien("0707"), null);
  assert.equal(telephoneIvoirien("+221 77 123 45 67"), null);
  assert.equal(telephoneIvoirien("7070707070"), null);
  assert.equal(telephoneCartflox("0707070707"), "+2250707070707");
});

test("les opérateurs proposés : Mobile Money de Côte d'Ivoire seulement, dans l'ordre habituel", () => {
  const liste = [
    { code: "MTN_CI", gatewayId: "g1", name: "MTN MoMo CI", country: "Côte d'Ivoire", type: "MOBILE_MONEY", logo: "/logos/mtn.png" },
    { code: "CARD", gatewayId: "g2", name: "Carte bancaire", country: "International", type: "Card", logo: null },
    { code: "WAVE_CI", gatewayId: "g1", name: "Wave CI", country: "Côte d'Ivoire", type: "MOBILE_MONEY", logo: "https://cdn.exemple/wave.png" },
    { code: "OM_CI", gatewayId: "g3", name: "Orange Money CI", country: "Côte d'Ivoire", type: "MOBILE_MONEY", logo: "logos/om.png" },
    { code: "WAVE_SN", gatewayId: "g1", name: "Wave SN", country: "Sénégal", type: "MOBILE_MONEY", logo: null },
    { code: "WAVE_CI2", gatewayId: "g4", name: "Wave Côte d'Ivoire", country: "Côte d'Ivoire", type: "MOBILE_MONEY", logo: null },
  ];
  assert.deepEqual(operateursIvoiriens(liste, "https://cartflox.com"), [
    { code: "WAVE_CI", gatewayId: "g1", nom: "Wave", logo: "https://cdn.exemple/wave.png" },
    { code: "OM_CI", gatewayId: "g3", nom: "Orange Money", logo: "https://cartflox.com/logos/om.png" },
    { code: "MTN_CI", gatewayId: "g1", nom: "MTN MoMo", logo: "https://cartflox.com/logos/mtn.png" },
  ]);
  assert.equal(nomOperateur("Moov Money CI"), "Moov Money");
});

test("les messages des opérateurs se disent en clair, sans point final", () => {
  assert.equal(messageOperateur("INSUFFICIENT_BALANCE"), "Solde insuffisant sur ce compte Mobile Money");
  assert.equal(messageOperateur("PAYER_NOT_FOUND"), "Ce numéro n'a pas de compte Mobile Money chez cet opérateur");
  assert.equal(messageOperateur("Numéro refusé par l'opérateur."), "Numéro refusé par l'opérateur");
  assert.equal(messageOperateur(null), "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
});

test("le numéro pendant qu'on le tape : l'indicatif collé ou tapé, le retour arrière, dix chiffres au plus", () => {
  // Collé ou proposé par le téléphone, avec son indicatif : ramené à ses 10 chiffres.
  assert.equal(saisieNumero("+225 07 07 07 07 07"), "07 07 07 07 07");
  assert.equal(saisieNumero("002250707070707"), "07 07 07 07 07");
  // L'indicatif tapé à la main : on attend la suite, puis le numéro revient à ses 10 chiffres.
  assert.equal(saisieNumero("225070707070"), "225070707070");
  assert.equal(saisieNumero("2250707070707"), "07 07 07 07 07");
  // Rien n'est regroupé pendant la frappe : un retour arrière après une espace efface bien un chiffre.
  assert.equal(saisieNumero("0707 07"), "0707 07");
  assert.equal(saisieNumero("07 "), "07 ");
  // Dix chiffres au plus, et rien d'autre que des chiffres et des espaces.
  assert.equal(saisieNumero("07 07 07 07 07 07"), "07 07 07 07 07");
  assert.equal(saisieNumero("07a07-07"), "070707");
});


test("le message de l'opérateur ne vouvoie jamais et ne montre ni code ni anglais", () => {
  assert.equal(messageOperateur("La demande n'a pas été validée sur votre téléphone à temps. Relancez le paiement."), "Tu n'as pas validé le paiement à temps sur ton téléphone : relance-le");
  assert.equal(messageOperateur("Veuillez vérifier votre solde"), "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
  assert.equal(messageOperateur("TRANSACTION_FAILED"), "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
  assert.equal(messageOperateur("The transaction could not be completed"), "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
  assert.equal(messageOperateur("USER_CANCELLED"), "Paiement annulé sur ton téléphone");
  assert.equal(messageOperateur("Daily limit exceeded"), "Ce paiement dépasse le plafond de ton compte Mobile Money");
  assert.equal(messageOperateur("Numéro refusé par l'opérateur."), "Numéro refusé par l'opérateur");
});
