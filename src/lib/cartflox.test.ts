// Essais des règles de Cartflox : les clés, le verdict d'un paiement, la signature d'un webhook. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { modeDesCles, sessionValable, signatureValide, signer, verdictPaiement } from "./cartflox.ts";

// Des clés FACTICES, de la bonne forme : jamais une vraie clé dans un essai.
const PUB_TEST = "af_test_pub_0123456789abcdef0123";
const SEC_TEST = "af_test_sec_0123456789abcdef0123";
const PUB_LIVE = "af_live_pub_0123456789abcdef0123";
const SEC_LIVE = "af_live_sec_0123456789abcdef0123";

test("deux clés du même mode vont ensemble", () => {
  assert.equal(modeDesCles(PUB_TEST, SEC_TEST), "test");
  assert.equal(modeDesCles(PUB_LIVE, SEC_LIVE), "live");
  assert.equal(modeDesCles(` ${PUB_TEST} `, `${SEC_TEST}\n`), "test");
});

test("Cartflox reste éteint si une clé manque, est mal formée ou mêle les deux modes", () => {
  assert.equal(modeDesCles(undefined, SEC_TEST), null);
  assert.equal(modeDesCles(PUB_TEST, ""), null);
  assert.equal(modeDesCles(PUB_TEST, SEC_LIVE), null);
  assert.equal(modeDesCles(PUB_LIVE, SEC_TEST), null);
  assert.equal(modeDesCles(SEC_TEST, PUB_TEST), null);
  assert.equal(modeDesCles("af_test_pub_court", SEC_TEST), null);
});

test("un identifiant de session a la forme de ceux de Cartflox", () => {
  assert.equal(sessionValable("cmmtlfj27000004l4nuzy1zz5"), true);
  assert.equal(sessionValable("CMMTLFJ27"), false);
  assert.equal(sessionValable("../../admin"), false);
  assert.equal(sessionValable(""), false);
});

test("payé en francs CFA, au moins le montant : on crédite", () => {
  assert.deepEqual(verdictPaiement({ status: "SUCCESS", paid: true, amount: 5000, currency: "XOF" }, 5000), { genre: "crediter" });
  // Des frais à la charge du payeur : Cartflox encaisse plus, on crédite quand même le montant de la recharge.
  assert.deepEqual(verdictPaiement({ status: "SUCCESS", paid: true, amount: 5150, currency: "xof" }, 5000), { genre: "crediter" });
});

test("payé moins que prévu, ou dans une autre monnaie : rien ne se crédite tout seul", () => {
  const moins = verdictPaiement({ status: "SUCCESS", paid: true, amount: 100, currency: "XOF" }, 5000);
  assert.equal(moins.genre, "a_verifier");
  assert.match(moins.genre === "a_verifier" ? moins.phrase.replace(/\s/g, "") : "", /100FCFAaulieude5000FCFA/);
  assert.equal(verdictPaiement({ status: "SUCCESS", paid: true, amount: 5000, currency: "EUR" }, 5000).genre, "a_verifier");
  assert.equal(verdictPaiement({ status: "SUCCESS", paid: true, currency: "XOF" }, 5000).genre, "a_verifier");
});

test("pas encore fini : on relira", () => {
  assert.deepEqual(verdictPaiement({ status: "PENDING", paid: false, amount: 5000, currency: "XOF" }, 5000), { genre: "attendre" });
  assert.deepEqual(verdictPaiement({ status: "PROCESSING" }, 5000), { genre: "attendre" });
  assert.deepEqual(verdictPaiement({}, 5000), { genre: "attendre" });
});

test("fini sans paiement : un échec, avec la raison de Cartflox s'il en donne une", () => {
  assert.deepEqual(verdictPaiement({ status: "FAILED", failure_message: "Solde insuffisant." }, 5000), { genre: "echec", phrase: "Solde insuffisant." });
  assert.deepEqual(verdictPaiement({ status: "cancelled" }, 5000), { genre: "echec", phrase: "Le paiement n'a pas abouti" });
  assert.equal(verdictPaiement({ status: "EXPIRED" }, 5000).genre, "echec");
});

test("un webhook bien signé passe, un webhook altéré, mal signé ou trop vieux est refusé", () => {
  const corps = JSON.stringify({ event: "payment.completed", data: { id: "cmmtlfj27000004l4nuzy1zz5", status: "SUCCESS" } });
  const t = 1_795_100_000;
  const entete = signer(corps, SEC_TEST, t);
  assert.equal(signatureValide(corps, entete, SEC_TEST, t + 10), true);
  assert.equal(signatureValide(corps.replace("SUCCESS", "FAILED"), entete, SEC_TEST, t + 10), false);
  assert.equal(signatureValide(corps, entete, SEC_LIVE, t + 10), false);
  assert.equal(signatureValide(corps, entete, SEC_TEST, t + 301), false);
  assert.equal(signatureValide(corps, entete, SEC_TEST, t - 301), false);
  assert.equal(signatureValide(corps, null, SEC_TEST, t), false);
  assert.equal(signatureValide(corps, "t=abc,v1=00", SEC_TEST, t), false);
  assert.equal(signatureValide(corps, `t=${t}`, SEC_TEST, t), false);
});
